from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ==================== AUTH ====================

class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_public: bool
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


# ==================== CARDS ====================

class CardCreate(BaseModel):
    pokedex_number: int
    name: str
    collector_number: str = ""
    image_url: str = ""
    quantity: int = 1
    rarity: str = ""
    set_name: str = ""
    condition: str = ""
    year: Optional[int] = None
    market_value: float = 0.0
    notes: str = ""
    date_acquired: str = ""
    grade: str = ""
    is_foil: bool = False
    is_holo: bool = False


class CardUpdate(BaseModel):
    pokedex_number: Optional[int] = None
    name: Optional[str] = None
    collector_number: Optional[str] = None
    image_url: Optional[str] = None
    quantity: Optional[int] = None
    rarity: Optional[str] = None
    set_name: Optional[str] = None
    condition: Optional[str] = None
    year: Optional[int] = None
    market_value: Optional[float] = None
    notes: Optional[str] = None
    date_acquired: Optional[str] = None
    grade: Optional[str] = None
    is_foil: Optional[bool] = None
    is_holo: Optional[bool] = None


class CardResponse(BaseModel):
    id: int
    pokedex_number: int
    name: str
    collector_number: str
    image_url: str
    quantity: int
    rarity: str
    set_name: str
    condition: str
    year: Optional[int]
    market_value: float
    notes: str
    date_acquired: str
    grade: str
    is_foil: bool
    is_holo: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== SHARING ====================

class CollectionShare(BaseModel):
    username: str
    cards: List[CardResponse]
    total_value: float
    total_cards: int


# ==================== RATINGS ====================

class RatingCreate(BaseModel):
    stars: int


class RatingResponse(BaseModel):
    id: int
    user_id: int
    target_user_id: int
    stars: int
    created_at: datetime

    class Config:
        from_attributes = True


class CollectionRatingStats(BaseModel):
    average_stars: float
    total_ratings: int
    like_count: int
    total_cards: int
    total_value: float
    unique_pokemon: int
    holo_count: int
    foil_count: int


# ==================== FEEDBACK ====================

class FeedbackCreate(BaseModel):
    message: str


class FeedbackResponse(BaseModel):
    id: int
    user_id: int
    username: str = ""
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== REPORTS ====================

class ReportCreate(BaseModel):
    reason: str


class ReportResponse(BaseModel):
    id: int
    reporter_id: int
    reporter_username: str = ""
    target_user_id: int
    target_username: str = ""
    reason: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== CHAT ====================

class ChatMessageCreate(BaseModel):
    message: str


class ChatMessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ChatConversation(BaseModel):
    user_id: int
    username: str
    last_message: str
    last_message_time: datetime
    unread_count: int


# ==================== ADMIN ====================

class AdminUserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_public: bool
    is_admin: bool
    is_banned: bool
    card_count: int
    created_at: datetime


class PublicCollectionPreview(BaseModel):
    user_id: int
    username: str
    card_count: int
    total_value: float
    unique_pokemon: int
    holo_count: int
    average_stars: float
    like_count: int
    top_cards: List[CardResponse]
