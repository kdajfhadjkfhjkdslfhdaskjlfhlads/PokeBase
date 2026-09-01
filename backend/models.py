from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_public = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    is_banned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    cards = relationship("Card", back_populates="owner")
    ratings_given = relationship("Rating", foreign_keys="Rating.user_id", back_populates="user")
    ratings_received = relationship("Rating", foreign_keys="Rating.target_user_id", back_populates="target_user")
    likes_given = relationship("Like", foreign_keys="Like.user_id", back_populates="user")
    likes_received = relationship("Like", foreign_keys="Like.target_user_id", back_populates="target_user")
    feedback_items = relationship("Feedback", back_populates="user")
    reports_filed = relationship("Report", foreign_keys="Report.reporter_id", back_populates="reporter")
    reports_received = relationship("Report", foreign_keys="Report.target_user_id", back_populates="target_user")
    sent_messages = relationship("ChatMessage", foreign_keys="ChatMessage.sender_id", back_populates="sender")
    received_messages = relationship("ChatMessage", foreign_keys="ChatMessage.receiver_id", back_populates="receiver")


class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pokedex_number = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)
    collector_number = Column(String(20), default="")
    image_url = Column(Text, default="")
    quantity = Column(Integer, default=1)
    rarity = Column(String(50), default="")
    set_name = Column(String(100), default="")
    condition = Column(String(50), default="")
    year = Column(Integer, nullable=True)
    market_value = Column(Float, default=0.0)
    notes = Column(Text, default="")
    date_acquired = Column(String(20), default="")
    grade = Column(String(20), default="")
    is_foil = Column(Boolean, default=False)
    is_holo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="cards")


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stars = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="ratings_given")
    target_user = relationship("User", foreign_keys=[target_user_id], back_populates="ratings_received")

    __table_args__ = (
        UniqueConstraint("user_id", "target_user_id", name="uq_user_target_rating"),
    )


class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="likes_given")
    target_user = relationship("User", foreign_keys=[target_user_id], back_populates="likes_received")

    __table_args__ = (
        UniqueConstraint("user_id", "target_user_id", name="uq_user_target_like"),
    )


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="feedback_items")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(String(255), nullable=False)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    reporter = relationship("User", foreign_keys=[reporter_id], back_populates="reports_filed")
    target_user = relationship("User", foreign_keys=[target_user_id], back_populates="reports_received")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")
