from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any
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

class ProjectRename(BaseModel):
    name: str

@router.get("/")
def get_projects(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # RLS: tylko wlasne projekty
    return db.query(Project).filter(Project.owner_id == current_user["id"]).all()

@router.post("/")
def create_project(proj: ProjectCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    db_project = Project(
        owner_id=current_user["id"],
        name=proj.name,
        domain=proj.domain,
        niche=proj.niche,
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
def rename_project(project_id: int, body: ProjectRename, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nie znaleziony")
    require_owner(project.owner_id, current_user)
    if not body.name or not body.name.strip():
        raise HTTPException(status_code=400, detail="Nazwa nie może być pusta")
    project.name = body.name.strip()[:200]
    db.commit()
    db.refresh(project)
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
