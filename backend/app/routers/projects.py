from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any, Optional
from ..database import get_db
from ..models import Project
from ..auth import get_current_user, require_owner
import subprocess
import os

router = APIRouter(prefix="/api/projects", tags=["Projects"])

class ProjectCreate(BaseModel):
    name: str
    domain: str
    niche: str
    content: Dict[str, Any]

class GitHubExport(BaseModel):
    repo_name: str
    github_token: str

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
    db.commit()
    db.refresh(db_project)
    return db_project

@router.post("/{project_id}/export-github")
def export_to_github(project_id: int, data: GitHubExport, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nie znaleziony")
    require_owner(project.owner_id, current_user)
    
    # Symulacja integracji z GitHubem / Zapis repozytorium
    project.github_repo = f"https://github.com/sitemorph-user/{data.repo_name}"
    db.commit()
    
    return {
        "status": "success", 
        "message": f"Projekt pomyslnie wyeksportowany do repozytorium: {project.github_repo}",
        "repo_url": project.github_repo
    }
