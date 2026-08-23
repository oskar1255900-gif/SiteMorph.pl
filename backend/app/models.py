from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from .database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, index=True, default="anon")  # RLS: wlasciciel wiersza
    name = Column(String, index=True)
    domain = Column(String, unique=True, index=True)
    niche = Column(String)
    content = Column(JSON) # Zawiera strukturę strony, teksty, zdjęcia, ceny
    github_repo = Column(String, nullable=True)

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, index=True, default="anon")  # RLS
    company_name = Column(String, index=True)
    website = Column(String, nullable=True)
    niche = Column(String, nullable=True)
    status = Column(String, default="Nowy") # Nowy, Wygenerowano stronę, Wysłano
    ai_score = Column(Integer, nullable=True)
    # Extended fields for OSM leads
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    country = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    osm_id = Column(String, nullable=True)
    osm_type = Column(String, nullable=True)
    lead_score = Column(Integer, nullable=True)
    industry = Column(String, nullable=True)

class PublishedPage(Base):
    __tablename__ = "published_pages"

    id = Column(String, primary_key=True)  # krótki token w URL /p/<id>
    owner_id = Column(String, index=True, default="anon")
    title = Column(String, nullable=True)
    html = Column(Text)  # samowystarczalny index.html
    created_at = Column(Float, nullable=True)
