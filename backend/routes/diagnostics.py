"""
Diagnostics API endpoints for error code management
Admin-only access for error codes registry and recent errors
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
from auth import get_authenticated_user
from utils.error_codes import error_code_manager
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])

@router.get("/error-codes")
async def get_error_codes(
    area: Optional[str] = Query(None, description="Filter by error area"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    search: Optional[str] = Query(None, description="Search in title or message"),
    current_user = Depends(get_authenticated_user)
):
    """
    Get error codes registry (Admin only)
    """
    # Only allow super admin or business admin access
    if current_user["role"] not in ["super_admin", "business_admin"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Admin privileges required."
        )
    
    try:
        all_errors = error_code_manager.get_all_errors()
        filtered_errors = {}
        
        for code, details in all_errors.items():
            # Apply filters
            if area and details.get("area", "").lower() != area.lower():
                continue
            if severity and details.get("severity", "").lower() != severity.lower():
                continue
            if search:
                search_text = f"{details.get('title', '')} {details.get('userMessage', '')}".lower()
                if search.lower() not in search_text:
                    continue
            
            filtered_errors[code] = details
        
        return {
            "ok": True,
            "data": filtered_errors,
            "metadata": error_code_manager.registry.get("metadata", {}),
            "filters": {
                "area": area,
                "severity": severity,
                "search": search
            }
        }
    
    except Exception as e:
        logger.error(f"Failed to get error codes: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve error codes"
        )

@router.get("/recent-errors")
async def get_recent_errors(
    limit: int = Query(50, le=100, description="Maximum number of recent errors"),
    current_user = Depends(get_authenticated_user)
):
    """
    Get recent errors (Admin only)
    """
    # Only allow super admin or business admin access
    if current_user["role"] not in ["super_admin", "business_admin"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Admin privileges required."
        )
    
    try:
        recent_errors = error_code_manager.get_recent_errors(limit)
        
        return {
            "ok": True,
            "data": recent_errors,
            "total": len(recent_errors),
            "limit": limit
        }
    
    except Exception as e:
        logger.error(f"Failed to get recent errors: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve recent errors"
        )

@router.get("/error-codes/{error_code}")
async def get_error_code_details(
    error_code: str,
    current_user = Depends(get_authenticated_user)
):
    """
    Get specific error code details (Admin only)
    """
    # Only allow super admin or business admin access
    if current_user["role"] not in ["super_admin", "business_admin"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Admin privileges required."
        )
    
    try:
        error_details = error_code_manager.get_error_details(error_code)
        
        if not error_details:
            raise HTTPException(
                status_code=404,
                detail=f"Error code {error_code} not found"
            )
        
        return {
            "ok": True,
            "data": {
                "errorCode": error_code,
                **error_details
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get error code details: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve error code details"
        )

@router.get("/export-recent-errors")
async def export_recent_errors(
    format: str = Query("json", regex="^(json|csv)$", description="Export format"),
    limit: int = Query(50, le=100, description="Maximum number of recent errors"),
    current_user = Depends(get_authenticated_user)
):
    """
    Export recent errors (Admin only)
    """
    # Only allow super admin or business admin access
    if current_user["role"] not in ["super_admin", "business_admin"]:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Admin privileges required."
        )
    
    try:
        recent_errors = error_code_manager.get_recent_errors(limit)
        
        if format == "csv":
            # Convert to CSV format
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=[
                'errorCode', 'title', 'lastSeenAt', 'occurrenceCount', 'severity', 'area'
            ])
            writer.writeheader()
            writer.writerows(recent_errors)
            
            csv_content = output.getvalue()
            output.close()
            
            return {
                "ok": True,
                "data": csv_content,
                "format": "csv",
                "filename": f"recent_errors_{limit}.csv"
            }
        else:
            # Return JSON format
            return {
                "ok": True,
                "data": recent_errors,
                "format": "json",
                "filename": f"recent_errors_{limit}.json"
            }
    
    except Exception as e:
        logger.error(f"Failed to export recent errors: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to export recent errors"
        )