import base64
import json
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional

from database import engine, get_db, Base
from models import User, Card, Rating, Like, Feedback, Report, ChatMessage
from schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    CardCreate, CardUpdate, CardResponse, CollectionShare,
    RatingCreate, RatingResponse, CollectionRatingStats,
    FeedbackCreate, FeedbackResponse,
    ReportCreate, ReportResponse,
    ChatMessageCreate, ChatMessageResponse, ChatConversation,
    AdminUserResponse, PublicCollectionPreview,
)
from auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, get_admin_user
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


# ==================== AUTH ====================

@app.post("/signup", response_model=Token)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        (User.username == user.username) | (User.email == user.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")

    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=get_password_hash(user.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(data={"sub": new_user.username})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/login", response_model=Token)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if db_user.is_banned:
        raise HTTPException(status_code=403, detail="Your account has been banned")
    if not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(data={"sub": db_user.username})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# ==================== CARDS ====================

@app.post("/cards", response_model=CardResponse)
def add_card(card: CardCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_card = Card(owner_id=current_user.id, **card.model_dump())
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    return new_card


@app.get("/cards", response_model=List[CardResponse])
def get_cards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Card).filter(Card.owner_id == current_user.id).order_by(Card.pokedex_number).all()


@app.get("/cards/stats")
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cards = db.query(Card).filter(Card.owner_id == current_user.id).all()
    total_cards = sum(c.quantity for c in cards)
    total_value = sum(c.market_value * c.quantity for c in cards)
    unique_pokemon = len(set(c.pokedex_number for c in cards))
    holo_count = sum(c.quantity for c in cards if c.is_holo)
    foil_count = sum(c.quantity for c in cards if c.is_foil)
    return {
        "total_cards": total_cards,
        "total_value": round(total_value, 2),
        "unique_pokemon": unique_pokemon,
        "holo_count": holo_count,
        "foil_count": foil_count
    }


@app.put("/cards/{card_id}", response_model=CardResponse)
def update_card(card_id: int, card: CardUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_card = db.query(Card).filter(Card.id == card_id, Card.owner_id == current_user.id).first()
    if not db_card:
        raise HTTPException(status_code=404, detail="Card not found")

    update_data = card.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_card, key, value)

    db.commit()
    db.refresh(db_card)
    return db_card


@app.delete("/cards/{card_id}")
def delete_card(card_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_card = db.query(Card).filter(Card.id == card_id, Card.owner_id == current_user.id).first()
    if not db_card:
        raise HTTPException(status_code=404, detail="Card not found")

    db.delete(db_card)
    db.commit()
    return {"detail": "Card deleted"}


# ==================== SHARING ====================

@app.get("/share/{username}", response_model=CollectionShare)
def get_shared_collection(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cards = db.query(Card).filter(Card.owner_id == user.id).order_by(Card.pokedex_number).all()
    total_value = sum(c.market_value * c.quantity for c in cards)
    total_cards = sum(c.quantity for c in cards)

    return CollectionShare(
        username=user.username,
        cards=cards,
        total_value=round(total_value, 2),
        total_cards=total_cards
    )


@app.get("/share/link/{username}")
def generate_share_link(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cards = db.query(Card).filter(Card.owner_id == user.id).order_by(Card.pokedex_number).all()
    total_value = sum(c.market_value * c.quantity for c in cards)
    total_cards = sum(c.quantity for c in cards)

    share_data = {
        "username": user.username,
        "cards": [
            {
                "pokedex_number": c.pokedex_number,
                "name": c.name,
                "collector_number": c.collector_number,
                "image_url": c.image_url,
                "quantity": c.quantity,
                "rarity": c.rarity,
                "set_name": c.set_name,
                "condition": c.condition,
                "year": c.year,
                "market_value": c.market_value,
                "notes": c.notes,
                "date_acquired": c.date_acquired,
                "grade": c.grade,
                "is_foil": c.is_foil,
                "is_holo": c.is_holo,
            }
            for c in cards
        ],
        "total_value": round(total_value, 2),
        "total_cards": total_cards,
    }

    encoded = base64.urlsafe_b64encode(json.dumps(share_data).encode()).decode()
    return {"share_link": f"/view.html?data={encoded}", "data": encoded}


# ==================== PUBLIC COLLECTIONS ====================

@app.put("/users/public")
def toggle_public(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.is_public = not current_user.is_public
    db.commit()
    return {"is_public": current_user.is_public}


def _get_collection_stats(db: Session, user_id: int):
    cards = db.query(Card).filter(Card.owner_id == user_id).all()
    total_cards = sum(c.quantity for c in cards)
    total_value = sum(c.market_value * c.quantity for c in cards)
    unique_pokemon = len(set(c.pokedex_number for c in cards))
    holo_count = sum(c.quantity for c in cards if c.is_holo)

    avg_stars_result = db.query(func.avg(Rating.stars)).filter(Rating.target_user_id == user_id).first()
    average_stars = round(avg_stars_result[0], 1) if avg_stars_result[0] else 0.0

    like_count = db.query(Like).filter(Like.target_user_id == user_id).count()

    return {
        "total_cards": total_cards,
        "total_value": round(total_value, 2),
        "unique_pokemon": unique_pokemon,
        "holo_count": holo_count,
        "average_stars": average_stars,
        "like_count": like_count,
    }


@app.get("/collections/public")
def get_public_collections(
    search: Optional[str] = Query(None),
    trending: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db)
):
    per_page = 12
    query = db.query(User).filter(User.is_public == True, User.is_banned == False)

    if search:
        query = query.filter(User.username.ilike(f"%{search}%"))

    users = query.all()

    results = []
    for user in users:
        cards = db.query(Card).filter(Card.owner_id == user.id).all()
        if not cards:
            continue

        total_cards = sum(c.quantity for c in cards)
        total_value = sum(c.market_value * c.quantity for c in cards)
        unique_pokemon = len(set(c.pokedex_number for c in cards))
        holo_count = sum(c.quantity for c in cards if c.is_holo)

        avg_stars_result = db.query(func.avg(Rating.stars)).filter(Rating.target_user_id == user.id).first()
        average_stars = round(avg_stars_result[0], 1) if avg_stars_result[0] else 0.0

        like_count = db.query(Like).filter(Like.target_user_id == user.id).count()

        top_cards = sorted(cards, key=lambda c: c.market_value, reverse=True)[:3]

        results.append({
            "user_id": user.id,
            "username": user.username,
            "card_count": total_cards,
            "total_value": round(total_value, 2),
            "unique_pokemon": unique_pokemon,
            "holo_count": holo_count,
            "average_stars": average_stars,
            "like_count": like_count,
            "top_cards": [CardResponse.model_validate(c) for c in top_cards],
        })

    if trending:
        results.sort(key=lambda x: (x["average_stars"] * 10 + x["like_count"] + x["card_count"] * 0.1), reverse=True)
    else:
        results.sort(key=lambda x: x["username"].lower())

    total = len(results)
    start = (page - 1) * per_page
    end = start + per_page

    return {
        "collections": results[start:end],
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
    }


# ==================== RATINGS & LIKES ====================

def _resolve_user_id(username: str, db: Session) -> int:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.id


@app.post("/collections/{target_username}/rate", response_model=RatingResponse)
def rate_collection(
    target_username: str,
    rating: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_id = _resolve_user_id(target_username, db)
    if target_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot rate your own collection")
    if rating.stars < 1 or rating.stars > 5:
        raise HTTPException(status_code=400, detail="Stars must be 1-5")

    existing = db.query(Rating).filter(
        Rating.user_id == current_user.id,
        Rating.target_user_id == target_id
    ).first()

    if existing:
        existing.stars = rating.stars
        db.commit()
        db.refresh(existing)
        return existing

    new_rating = Rating(
        user_id=current_user.id,
        target_user_id=target_id,
        stars=rating.stars
    )
    db.add(new_rating)
    db.commit()
    db.refresh(new_rating)
    return new_rating


@app.delete("/collections/{target_username}/rate")
def remove_rating(
    target_username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_id = _resolve_user_id(target_username, db)
    rating = db.query(Rating).filter(
        Rating.user_id == current_user.id,
        Rating.target_user_id == target_id
    ).first()
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    db.delete(rating)
    db.commit()
    return {"detail": "Rating removed"}


@app.get("/collections/{target_username}/rating")
def get_my_rating(
    target_username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_id = _resolve_user_id(target_username, db)
    rating = db.query(Rating).filter(
        Rating.user_id == current_user.id,
        Rating.target_user_id == target_id
    ).first()

    avg_result = db.query(func.avg(Rating.stars)).filter(Rating.target_user_id == target_id).first()
    average_stars = round(avg_result[0], 1) if avg_result[0] else 0.0
    total_ratings = db.query(Rating).filter(Rating.target_user_id == target_id).count()
    like_count = db.query(Like).filter(Like.target_user_id == target_id).count()
    liked = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.target_user_id == target_id
    ).first() is not None

    return {
        "my_stars": rating.stars if rating else 0,
        "average_stars": average_stars,
        "total_ratings": total_ratings,
        "like_count": like_count,
        "liked": liked,
    }


@app.post("/collections/{target_username}/like")
def toggle_like(
    target_username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_id = _resolve_user_id(target_username, db)
    if target_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot like your own collection")

    existing = db.query(Like).filter(
        Like.user_id == current_user.id,
        Like.target_user_id == target_id
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return {"liked": False, "like_count": db.query(Like).filter(Like.target_user_id == target_id).count()}

    new_like = Like(user_id=current_user.id, target_user_id=target_id)
    db.add(new_like)
    db.commit()
    return {"liked": True, "like_count": db.query(Like).filter(Like.target_user_id == target_id).count()}


# ==================== FEEDBACK ====================

@app.post("/feedback", response_model=FeedbackResponse)
def submit_feedback(
    feedback: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_feedback = Feedback(user_id=current_user.id, message=feedback.message)
    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)
    return FeedbackResponse(
        id=new_feedback.id,
        user_id=new_feedback.user_id,
        username=current_user.username,
        message=new_feedback.message,
        created_at=new_feedback.created_at,
    )


@app.get("/admin/feedback", response_model=List[FeedbackResponse])
def get_all_feedback(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    items = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    result = []
    for f in items:
        user = db.query(User).filter(User.id == f.user_id).first()
        result.append(FeedbackResponse(
            id=f.id,
            user_id=f.user_id,
            username=user.username if user else "Unknown",
            message=f.message,
            created_at=f.created_at,
        ))
    return result


@app.delete("/admin/feedback/{feedback_id}")
def delete_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    db.delete(fb)
    db.commit()
    return {"detail": "Feedback deleted"}


# ==================== REPORTS ====================

@app.post("/collections/{target_username}/report", response_model=ReportResponse)
def report_collection(
    target_username: str,
    report: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_id = _resolve_user_id(target_username, db)
    if target_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot report your own collection")

    new_report = Report(
        reporter_id=current_user.id,
        target_user_id=target_id,
        reason=report.reason
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return ReportResponse(
        id=new_report.id,
        reporter_id=new_report.reporter_id,
        reporter_username=current_user.username,
        target_user_id=new_report.target_user_id,
        target_username=target_username,
        reason=new_report.reason,
        status=new_report.status,
        created_at=new_report.created_at,
    )


@app.get("/admin/reports", response_model=List[ReportResponse])
def get_all_reports(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    query = db.query(Report)
    if status_filter:
        query = query.filter(Report.status == status_filter)
    reports = query.order_by(Report.created_at.desc()).all()

    result = []
    for r in reports:
        reporter = db.query(User).filter(User.id == r.reporter_id).first()
        target = db.query(User).filter(User.id == r.target_user_id).first()
        result.append(ReportResponse(
            id=r.id,
            reporter_id=r.reporter_id,
            reporter_username=reporter.username if reporter else "Unknown",
            target_user_id=r.target_user_id,
            target_username=target.username if target else "Unknown",
            reason=r.reason,
            status=r.status,
            created_at=r.created_at,
        ))
    return result


@app.put("/admin/reports/{report_id}")
def update_report(
    report_id: int,
    report_update: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    db_report = db.query(Report).filter(Report.id == report_id).first()
    if not db_report:
        raise HTTPException(status_code=404, detail="Report not found")
    db_report.status = report_update.get("status", db_report.status)
    db.commit()
    return {"detail": "Report updated"}


# ==================== CHAT ====================

@app.get("/chat/conversations")
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sent = db.query(ChatMessage.sender_id).filter(ChatMessage.receiver_id == current_user.id)
    received = db.query(ChatMessage.receiver_id).filter(ChatMessage.sender_id == current_user.id)
    user_ids = set([r[0] for r in sent.all()] + [r[0] for r in received.all()])

    conversations = []
    for uid in user_ids:
        user = db.query(User).filter(User.id == uid).first()
        if not user:
            continue

        last_msg = db.query(ChatMessage).filter(
            or_(
                (ChatMessage.sender_id == current_user.id) & (ChatMessage.receiver_id == uid),
                (ChatMessage.sender_id == uid) & (ChatMessage.receiver_id == current_user.id),
            )
        ).order_by(ChatMessage.created_at.desc()).first()

        unread = db.query(ChatMessage).filter(
            ChatMessage.sender_id == uid,
            ChatMessage.receiver_id == current_user.id,
            ChatMessage.is_read == False
        ).count()

        conversations.append({
            "user_id": uid,
            "username": user.username,
            "last_message": last_msg.message if last_msg else "",
            "last_message_time": last_msg.created_at if last_msg else None,
            "unread_count": unread,
        })

    conversations.sort(key=lambda x: x["last_message_time"] or "", reverse=True)
    return conversations


@app.get("/chat/{user_id}", response_model=List[ChatMessageResponse])
def get_messages(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    messages = db.query(ChatMessage).filter(
        or_(
            (ChatMessage.sender_id == current_user.id) & (ChatMessage.receiver_id == user_id),
            (ChatMessage.sender_id == user_id) & (ChatMessage.receiver_id == current_user.id),
        )
    ).order_by(ChatMessage.created_at.asc()).all()
    return messages


@app.post("/chat/{user_id}", response_model=ChatMessageResponse)
def send_message(
    user_id: int,
    msg: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    new_msg = ChatMessage(
        sender_id=current_user.id,
        receiver_id=user_id,
        message=msg.message
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    return new_msg


@app.put("/chat/{user_id}/read")
def mark_read(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(ChatMessage).filter(
        ChatMessage.sender_id == user_id,
        ChatMessage.receiver_id == current_user.id,
        ChatMessage.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"detail": "Messages marked as read"}


@app.get("/chat/unread/count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = db.query(ChatMessage).filter(
        ChatMessage.receiver_id == current_user.id,
        ChatMessage.is_read == False
    ).count()
    return {"unread_count": count}


# ==================== ADMIN ====================

@app.get("/admin/users", response_model=List[AdminUserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        card_count = db.query(Card).filter(Card.owner_id == u.id).count()
        result.append(AdminUserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            is_public=u.is_public,
            is_admin=u.is_admin,
            is_banned=u.is_banned,
            card_count=card_count,
            created_at=u.created_at,
        ))
    return result


@app.put("/admin/users/{user_id}/ban")
def toggle_ban(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot ban an admin")
    user.is_banned = not user.is_banned
    db.commit()
    return {"is_banned": user.is_banned}


@app.delete("/admin/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot delete an admin")

    db.query(Card).filter(Card.owner_id == user_id).delete()
    db.query(Rating).filter((Rating.user_id == user_id) | (Rating.target_user_id == user_id)).delete()
    db.query(Like).filter((Like.user_id == user_id) | (Like.target_user_id == user_id)).delete()
    db.query(Feedback).filter(Feedback.user_id == user_id).delete()
    db.query(Report).filter((Report.reporter_id == user_id) | (Report.target_user_id == user_id)).delete()
    db.query(ChatMessage).filter((ChatMessage.sender_id == user_id) | (ChatMessage.receiver_id == user_id)).delete()
    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}


@app.delete("/admin/cards/{card_id}")
def admin_delete_card(
    card_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
    return {"detail": "Card deleted"}


@app.get("/admin/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    total_users = db.query(User).count()
    total_cards = db.query(Card).count()
    public_users = db.query(User).filter(User.is_public == True).count()
    banned_users = db.query(User).filter(User.is_banned == True).count()
    total_reports = db.query(Report).filter(Report.status == "pending").count()
    total_feedback = db.query(Feedback).count()
    total_messages = db.query(ChatMessage).count()
    return {
        "total_users": total_users,
        "total_cards": total_cards,
        "public_users": public_users,
        "banned_users": banned_users,
        "pending_reports": total_reports,
        "total_feedback": total_feedback,
        "total_messages": total_messages,
    }


# ==================== FRONTEND ====================

app.mount("/css", StaticFiles(directory="../css"), name="css")
app.mount("/js", StaticFiles(directory="../js"), name="js")


@app.get("/robots.txt")
def serve_robots():
    return FileResponse("../robots.txt", media_type="text/plain")


@app.get("/sitemap.xml")
def serve_sitemap():
    return FileResponse("../sitemap.xml", media_type="application/xml")


@app.get("/")
def serve_index():
    return FileResponse("../index.html")


@app.get("/login.html")
def serve_login():
    return FileResponse("../login.html")


@app.get("/signup.html")
def serve_signup():
    return FileResponse("../signup.html")


@app.get("/dashboard.html")
def serve_dashboard():
    return FileResponse("../dashboard.html")


@app.get("/add.html")
def serve_add():
    return FileResponse("../add.html")


@app.get("/edit.html")
def serve_edit():
    return FileResponse("../edit.html")


@app.get("/view.html")
def serve_view():
    return FileResponse("../view.html")


@app.get("/profile.html")
def serve_profile():
    return FileResponse("../profile.html")


@app.get("/chat.html")
def serve_chat():
    return FileResponse("../chat.html")


@app.get("/admin.html")
def serve_admin():
    return FileResponse("../admin.html")


if __name__ == "__main__":
    import sys
    import uvicorn

    if len(sys.argv) > 2 and sys.argv[1] == "make-admin":
        username = sys.argv[2]
        from database import SessionLocal
        db = SessionLocal()
        user = db.query(User).filter(User.username == username).first()
        if user:
            user.is_admin = True
            db.commit()
            print(f"User '{username}' is now an admin")
        else:
            print(f"User '{username}' not found")
        db.close()
        sys.exit(0)

    uvicorn.run(app, host="0.0.0.0", port=8000)
