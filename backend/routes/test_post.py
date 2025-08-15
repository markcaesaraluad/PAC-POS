from fastapi import APIRouter, Request
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class TestRequest(BaseModel):
    test_data: str

@router.post("/test-post")
async def test_post_request(test_request: TestRequest, request: Request):
    """Simple POST endpoint to test if POST requests work through ingress"""
    logger.info(f"TEST_POST: received data={test_request.test_data}")
    logger.info(f"TEST_POST: url={request.url}, method={request.method}")
    logger.info(f"TEST_POST: headers={dict(request.headers)}")
    
    return {
        "status": "success",
        "message": "POST request received successfully",
        "received_data": test_request.test_data,
        "request_url": str(request.url),
        "request_method": request.method
    }