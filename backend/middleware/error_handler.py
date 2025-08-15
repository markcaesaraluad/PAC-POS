"""
Global Error Handling Middleware for POS System
Catches all unhandled exceptions and standardizes error responses
"""
import traceback
import logging
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Dict, Any
import time

from utils.error_codes import (
    error_code_manager, 
    generate_correlation_id, 
    create_error_response,
    log_error_with_context
)

logger = logging.getLogger(__name__)

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Global error handling middleware"""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        correlation_id = generate_correlation_id()
        
        # Add correlation ID to request state for access in routes
        request.state.correlation_id = correlation_id
        
        start_time = time.time()
        
        try:
            response = await call_next(request)
            return response
            
        except HTTPException as http_exc:
            # Handle FastAPI HTTP exceptions
            context = self._build_context(request, http_exc, start_time)
            error_code, error_details = error_code_manager.get_or_create_error_code(context)
            
            # Log the error
            log_error_with_context(
                correlation_id=correlation_id,
                error_code=error_code,
                exception=http_exc,
                context=context,
                logger_instance=logger
            )
            
            # Return standardized error response
            error_response = create_error_response(
                error_code=error_code,
                correlation_id=correlation_id,
                message=error_details.get("userMessage", http_exc.detail),
                details={
                    "statusCode": http_exc.status_code,
                    "path": str(request.url.path)
                }
            )
            
            return JSONResponse(
                status_code=http_exc.status_code,
                content=error_response
            )
            
        except Exception as exc:
            # Handle all other unhandled exceptions
            context = self._build_context(request, exc, start_time)
            error_code, error_details = error_code_manager.get_or_create_error_code(context)
            
            # TEMPORARY DEBUG: Log the full exception details
            logger.error(f"[{correlation_id}] UNHANDLED_EXCEPTION_DEBUG: {type(exc).__name__}: {str(exc)}")
            logger.error(f"[{correlation_id}] FULL_TRACEBACK: {traceback.format_exc()}")
            logger.error(f"[{correlation_id}] REQUEST_URL: {request.url}")
            logger.error(f"[{correlation_id}] REQUEST_METHOD: {request.method}")
            logger.error(f"[{correlation_id}] REQUEST_HEADERS: {dict(request.headers)}")
            
            # Log the error with full stack trace
            log_error_with_context(
                correlation_id=correlation_id,
                error_code=error_code,
                exception=exc,
                context=context,
                logger_instance=logger
            )
            
            # Return standardized error response (500 for unhandled exceptions)
            error_response = create_error_response(
                error_code=error_code,
                correlation_id=correlation_id,
                message=error_details.get("userMessage", "An unexpected error occurred"),
                details={
                    "statusCode": 500,
                    "path": str(request.url.path)
                }
            )
            
            return JSONResponse(
                status_code=500,
                content=error_response
            )
    
    def _build_context(self, request: Request, exception: Exception, start_time: float) -> Dict[str, Any]:
        """Build error context for logging and error code generation"""
        context = {
            "endpoint": str(request.url.path),
            "method": request.method,
            "error_type": type(exception).__name__,
            "error_message": str(exception),
            "user_agent": request.headers.get("user-agent", ""),
            "processing_time": time.time() - start_time
        }
        
        # Add HTTP status code if available
        if hasattr(exception, 'status_code'):
            context["status_code"] = exception.status_code
        elif isinstance(exception, HTTPException):
            context["status_code"] = exception.status_code
        else:
            context["status_code"] = 500
        
        # Add user context if available (without exposing sensitive data)
        if hasattr(request.state, 'current_user') and request.state.current_user:
            user = request.state.current_user
            context["user_id"] = str(user.get("_id", ""))
            context["user_role"] = user.get("role", "")
            context["business_id"] = str(user.get("business_id", ""))
        
        # Add request size (for payload analysis)
        content_length = request.headers.get("content-length")
        if content_length:
            context["payload_size"] = int(content_length)
        
        return context

def setup_error_handling(app):
    """Setup global error handling for the FastAPI app"""
    app.add_middleware(ErrorHandlingMiddleware)
    
    # Configure logging format
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger.info("Global error handling middleware setup complete")