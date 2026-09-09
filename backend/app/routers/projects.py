from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
from ..database import get_db
from ..models import Project
from ..auth import get_current_user, require_owner

router = APIRouter(prefix="/api/projects", tags=["Projects"])

class ProjectCreate(BaseModel):
    name: str
    domain: str
    niche: str
    content: Dict[str, Any]

class GitHubExport(BaseModel):
    repo_name: str
    github_token: str

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    niche: Optional[str] = None
    content: Optional[Dict[str, Any]] = None

@router.get("/")
def get_projects(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # RLS: tylko wlasne projekty
    return db.query(Project).filter(Project.owner_id == current_user["id"]).all()

@router.post("/")
def create_project(proj: ProjectCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Saving the same generated domain again should update the owner's project
    # instead of producing a noisy 409. A domain owned by somebody else remains
    # a real conflict because the database column is globally unique.
    existing = db.query(Project).filter(Project.domain == proj.domain).first()
    if existing:
        if existing.owner_id != current_user["id"]:
            raise HTTPException(status_code=409, detail="Ta domena projektu jest już zajęta")
        existing.name = proj.name.strip()[:200]
        existing.niche = proj.niche.strip()[:200]
        existing.content = proj.content
        db.commit()
        db.refresh(existing)
        return existing

    db_project = Project(
        owner_id=current_user["id"],
        name=proj.name.strip()[:200],
        domain=proj.domain.strip()[:255],
        niche=proj.niche.strip()[:200],
        content=proj.content
    )
    db.add(db_project)
    try:
        db.commit()
        db.refresh(db_project)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Projekt z taką domeną już istnieje")
    return db_project

@router.patch("/{project_id}")
def update_project(project_id: int, body: ProjectUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nie znaleziony")
    require_owner(project.owner_id, current_user)

    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(status_code=400, detail="Nazwa nie może być pusta")
        project.name = body.name.strip()[:200]
    if body.domain is not None:
        domain = body.domain.strip()[:255]
        if not domain:
            raise HTTPException(status_code=400, detail="Domena nie może być pusta")
        conflict = (
            db.query(Project)
            .filter(Project.domain == domain, Project.id != project_id)
            .first()
        )
        if conflict:
            raise HTTPException(status_code=409, detail="Projekt z taką domeną już istnieje")
        project.domain = domain
    if body.niche is not None:
        project.niche = body.niche.strip()[:200]
    if body.content is not None:
        project.content = body.content

    try:
        db.commit()
        db.refresh(project)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Projekt z taką domeną już istnieje")
    return project

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nie znaleziony")
    require_owner(project.owner_id, current_user)
    db.delete(project)
    db.commit()
    return {"status": "deleted"}

@router.post("/{project_id}/export-github")
def export_to_github(project_id: int, data: GitHubExport, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nie znaleziony")
    require_owner(project.owner_id, current_user)
    
    # Symulacja integracji z GitHubem — token jest przyjmowany, ale na razie
    # nieużywany (brak realnego tworzenia repo); zapisujemy tylko URL.
    project.github_repo = f"https://github.com/sitemorph-user/{data.repo_name}"
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Nie udało się zapisać projektu")

    return {
        "status": "success",
        "message": f"Projekt pomyslnie wyeksportowany do repozytorium: {project.github_repo}",
        "repo_url": project.github_repo,
        "warning": "Eksport jest obecnie symulacją — repozytorium nie zostało faktycznie utworzone na GitHubie",
    }
