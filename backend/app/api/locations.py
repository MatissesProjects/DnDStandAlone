from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import logging

from app.db.database import get_db
from app.models import models
from app.schemas import schemas
from app.crud import crud
from app.api import auth

router = APIRouter(tags=["locations"])
logger = logging.getLogger(__name__)

@router.post("/locations", response_model=schemas.Location)
def create_location(
    location: schemas.LocationCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can create locations")
    return crud.create_location(db=db, location=location)

@router.patch("/locations/{location_id}", response_model=schemas.Location)
def update_location(
    location_id: int,
    location_update: schemas.LocationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can update locations")
    return crud.update_location(db=db, location_id=location_id, location_update=location_update)

@router.delete("/locations/{location_id}")
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can delete locations")
    if crud.delete_location(db=db, location_id=location_id):
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Location not found")

@router.patch("/locations/{location_id}/canvas", response_model=schemas.Location)
def update_location_canvas(
    location_id: int,
    update: schemas.LocationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can save canvas state")
    return crud.update_location(db=db, location_id=location_id, location_update=update)

@router.get("/locations/{location_id}/entities", response_model=List[schemas.Entity])
def read_entities(location_id: int, db: Session = Depends(get_db)):
    return crud.get_entities(db, location_id=location_id)

@router.post("/entities", response_model=schemas.Entity)
def create_entity(
    entity: schemas.EntityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can materialize entities")
    return crud.create_entity(db=db, entity=entity)

@router.patch("/entities/{entity_id}", response_model=schemas.Entity)
def update_entity(
    entity_id: int,
    entity_update: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can update entities")
    return crud.update_entity(db=db, entity_id=entity_id, entity_update=entity_update)

@router.delete("/entities/{entity_id}")
def delete_entity(
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can delete entities")
    if crud.delete_entity(db=db, entity_id=entity_id):
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Entity not found")

@router.post("/handouts", response_model=schemas.Handout)
def create_handout(
    handout: schemas.HandoutCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can create handouts")
    return crud.create_handout(db=db, handout=handout)

@router.patch("/handouts/{handout_id}", response_model=schemas.Handout)
def update_handout(
    handout_id: int,
    handout_update: schemas.HandoutUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can move handouts")
    return crud.update_handout(db=db, handout_id=handout_id, handout_update=handout_update)

@router.delete("/handouts/{handout_id}")
def delete_handout(
    handout_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "gm":
        raise HTTPException(status_code=403, detail="Only GMs can delete handouts")
    if crud.delete_handout(db=db, handout_id=handout_id):
        return {"status": "ok"}
    raise HTTPException(status_code=404, detail="Handout not found")
