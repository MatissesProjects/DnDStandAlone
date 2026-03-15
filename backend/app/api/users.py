from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import logging

from app.db.database import get_db
from app.models import models
from app.schemas import schemas
from app.api import auth
from app.crud import crud

router = APIRouter(tags=["users"])
logger = logging.getLogger(__name__)

@router.get("/characters", response_model=List[schemas.User])
def list_characters(db: Session = Depends(get_db)):
    # Simple character list for the login screen
    return db.query(models.User).filter(~models.User.discord_id.startswith("guest_")).all()

@router.patch("/users/me", response_model=schemas.User)
def update_me(
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.update_user(db=db, user_id=current_user.id, user_update=user_update)

@router.get("/users/me/campaigns", response_model=List[schemas.Campaign])
def read_my_campaigns(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_user_campaigns(db, user_id=current_user.id)
