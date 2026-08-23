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
    # Własna domena klienta (np. biznesklienta.pl) wskazująca na SiteMorph
    custom_domain = Column(String, unique=True, index=True, nullable=True)
    domain_verified = Column(Integer, default=0)  # 0/1 — DNS zweryfikowany
    domain_verified_at = Column(Float, nullable=True)


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, index=True, default="anon")
    number = Column(String, unique=True, index=True)  # np. FV/2026/08/001
    created_at = Column(Float, nullable=True)
    seller = Column(JSON)   # {name, address, nip, email}
    buyer = Column(JSON)    # {name, address, nip, email}
    items = Column(JSON)    # [{name, qty, unit, vat}]
    payment_method = Column(String, default="przelew")  # paypal | blik | przelew
    payment_details = Column(JSON, nullable=True)       # {paypal_link, phone, iban}
    total = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    sent_to = Column(String, nullable=True)
    sent_at = Column(Float, nullable=True)


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(String, primary_key=True, index=True)
    data = Column(JSON)  # dane sprzedawcy: nazwa, adres, NIP, PayPal, Blik, IBAN...
    credits = Column(Integer, default=0)  # kredyty użytkownika
    updated_at = Column(Float, nullable=True)
