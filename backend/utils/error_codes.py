"""
Unified Error Code System for POS
Handles error code generation, registration, and management
"""
import json
import uuid
import os
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class ErrorSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"  
    HIGH = "high"

class ErrorArea(Enum):
    POS = "POS"
    SETTINGS = "SETTINGS"
    REPORT = "REPORT"
    DB = "DB"
    AUTH = "AUTH"
    PRINT = "PRINT"
    INVENTORY = "INVENTORY"
    CUSTOMER = "CUSTOMER"
    UNKNOWN = "UNKNOWN"

class ErrorCodeManager:
    def __init__(self, registry_path: str = "/app/error-codes.json"):
        self.registry_path = registry_path
        self.registry = self._load_registry()
        
    def _load_registry(self) -> Dict[str, Any]:
        """Load error code registry from JSON file"""
        try:
            if os.path.exists(self.registry_path):
                with open(self.registry_path, 'r') as f:
                    return json.load(f)
            else:
                # Create empty registry if file doesn't exist
                empty_registry = {
                    "registry": {},
                    "metadata": {
                        "version": "1.0.0",
                        "lastUpdated": datetime.now(timezone.utc).isoformat(),
                        "totalCodes": 0,
                        "nextSequence": {area.value: 1 for area in ErrorArea}
                    }
                }
                self._save_registry(empty_registry)
                return empty_registry
        except Exception as e:
            logger.error(f"Failed to load error registry: {e}")
            # Return minimal registry on failure
            return {
                "registry": {},
                "metadata": {
                    "version": "1.0.0",
                    "lastUpdated": datetime.now(timezone.utc).isoformat(),
                    "totalCodes": 0,
                    "nextSequence": {area.value: 1 for area in ErrorArea}
                }
            }
    
    def _save_registry(self, registry: Dict[str, Any]) -> None:
        """Save error code registry to JSON file"""
        try:
            registry["metadata"]["lastUpdated"] = datetime.now(timezone.utc).isoformat()
            with open(self.registry_path, 'w') as f:
                json.dump(registry, f, indent=2)
            self.registry = registry
        except Exception as e:
            logger.error(f"Failed to save error registry: {e}")
    
    def _determine_error_area(self, context: Dict[str, Any]) -> ErrorArea:
        """Determine error area based on context"""
        endpoint = context.get('endpoint', '').lower()
        error_type = context.get('error_type', '').lower()
        
        # Map endpoints to areas
        if '/api/auth' in endpoint:
            return ErrorArea.AUTH
        elif '/api/sales' in endpoint or '/pos' in endpoint:
            return ErrorArea.POS
        elif '/api/reports' in endpoint or 'export' in endpoint:
            return ErrorArea.REPORT
        elif '/api/business' in endpoint and ('logo' in endpoint or 'settings' in endpoint):
            return ErrorArea.SETTINGS
        elif '/api/customers' in endpoint:
            return ErrorArea.CUSTOMER
        elif '/api/products' in endpoint:
            return ErrorArea.INVENTORY
        elif 'print' in error_type or 'printer' in error_type:
            return ErrorArea.PRINT
        elif 'database' in error_type or 'mongo' in error_type or 'connection' in error_type:
            return ErrorArea.DB
        else:
            return ErrorArea.UNKNOWN
    
    def _generate_error_code(self, area: ErrorArea) -> str:
        """Generate next available error code for the area"""
        next_seq = self.registry["metadata"]["nextSequence"].get(area.value, 1)
        error_code = f"{area.value}-{next_seq:03d}"
        
        # Update next sequence
        self.registry["metadata"]["nextSequence"][area.value] = next_seq + 1
        self.registry["metadata"]["totalCodes"] += 1
        
        return error_code
    
    def _create_auto_error_entry(self, error_code: str, area: ErrorArea, context: Dict[str, Any]) -> Dict[str, Any]:
        """Create an automatically generated error entry"""
        error_type = context.get('error_type', 'Unknown error')
        endpoint = context.get('endpoint', 'Unknown endpoint')
        
        # Generate user-friendly messages based on area
        area_messages = {
            ErrorArea.POS: "An error occurred during checkout. Please try again.",
            ErrorArea.AUTH: "Authentication failed. Please sign in again.",
            ErrorArea.REPORT: "Could not generate report. Please try again.",
            ErrorArea.SETTINGS: "Settings could not be updated. Please try again.",
            ErrorArea.PRINT: "Printing failed. Please check printer connection.",
            ErrorArea.DB: "Database error occurred. Please try again.",
            ErrorArea.INVENTORY: "Product operation failed. Please try again.",
            ErrorArea.CUSTOMER: "Customer operation failed. Please try again.",
            ErrorArea.UNKNOWN: "An unexpected error occurred. Please try again."
        }
        
        return {
            "title": f"Auto-generated: {error_type}",
            "userMessage": area_messages.get(area, "An error occurred. Please try again."),
            "devCause": f"Auto-detected from {endpoint}: {error_type}",
            "commonFix": "Check server logs with correlationId for details",
            "severity": "medium",  # Default to medium for auto-generated
            "area": area.value,
            "lastSeenAt": datetime.now(timezone.utc).isoformat(),
            "occurrenceCount": 1,
            "autoGenerated": True
        }
    
    def get_or_create_error_code(self, context: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """
        Get existing error code or create new one based on context
        Returns (error_code, error_details)
        """
        error_type = context.get('error_type', '')
        endpoint = context.get('endpoint', '')
        
        # Try to match existing error codes based on context
        existing_code = self._match_existing_error(context)
        if existing_code:
            error_details = self.registry["registry"][existing_code]
            # Update occurrence count and last seen time
            error_details["occurrenceCount"] = error_details.get("occurrenceCount", 0) + 1
            error_details["lastSeenAt"] = datetime.now(timezone.utc).isoformat()
            self._save_registry(self.registry)
            return existing_code, error_details
        
        # Create new error code automatically
        area = self._determine_error_area(context)
        error_code = self._generate_error_code(area)
        error_details = self._create_auto_error_entry(error_code, area, context)
        
        # Add to registry
        self.registry["registry"][error_code] = error_details
        self._save_registry(self.registry)
        
        logger.info(f"Auto-generated new error code: {error_code} for context: {context}")
        return error_code, error_details
    
    def _match_existing_error(self, context: Dict[str, Any]) -> Optional[str]:
        """Try to match context to existing error codes"""
        error_type = context.get('error_type', '').lower()
        endpoint = context.get('endpoint', '').lower()
        status_code = context.get('status_code', 0)
        
        # Define matching patterns for known errors
        patterns = {
            'POS-SCAN-001': ['barcode', 'not found', '404', 'product not found'],
            'POS-PAY-001': ['insufficient', 'payment', 'amount', 'less than'],
            'POS-PAY-002': ['payment', 'save', 'failed', 'transaction'],
            'POS-PRINT-001': ['printer', 'not configured', 'missing'],
            'POS-PRINT-002': ['print', 'failed', 'bluetooth', 'connection'],
            'SETTINGS-IMG-001': ['logo', 'upload', 'failed', 'image'],
            'REPORT-EXP-001': ['pdf', 'export', 'failed', 'generate'],
            'DB-TXN-001': ['database', 'transaction', 'save', 'insert', 'mongo'],
            'AUTH-001': ['session', 'expired', 'token', 'invalid', '401', 'unauthorized']
        }
        
        for error_code, keywords in patterns.items():
            if error_code in self.registry["registry"]:
                # Check if any keywords match the context
                context_text = f"{error_type} {endpoint}".lower()
                if any(keyword in context_text for keyword in keywords):
                    return error_code
        
        return None
    
    def get_error_details(self, error_code: str) -> Optional[Dict[str, Any]]:
        """Get error details by code"""
        return self.registry["registry"].get(error_code)
    
    def get_all_errors(self) -> Dict[str, Any]:
        """Get all error codes in registry"""
        return self.registry["registry"]
    
    def get_recent_errors(self, limit: int = 50) -> list:
        """Get recent errors sorted by last seen time"""
        errors = []
        for code, details in self.registry["registry"].items():
            if details.get("lastSeenAt"):
                errors.append({
                    "errorCode": code,
                    "title": details["title"],
                    "lastSeenAt": details["lastSeenAt"],
                    "occurrenceCount": details.get("occurrenceCount", 0),
                    "severity": details["severity"],
                    "area": details["area"]
                })
        
        # Sort by last seen time (most recent first)
        errors.sort(key=lambda x: x["lastSeenAt"], reverse=True)
        return errors[:limit]

# Global instance
error_code_manager = ErrorCodeManager()

def generate_correlation_id() -> str:
    """Generate a UUID correlation ID"""
    return str(uuid.uuid4())

def create_error_response(
    error_code: str,
    correlation_id: str,
    message: str = None,
    details: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Create standardized error response"""
    error_details = error_code_manager.get_error_details(error_code)
    
    return {
        "ok": False,
        "errorCode": error_code,
        "message": message or (error_details["userMessage"] if error_details else "An error occurred"),
        "correlationId": correlation_id,
        "details": details or {}
    }

def log_error_with_context(
    correlation_id: str,
    error_code: str,
    exception: Exception,
    context: Dict[str, Any],
    logger_instance: logging.Logger = None
) -> None:
    """Log error with full context"""
    if logger_instance is None:
        logger_instance = logger
    
    logger_instance.error(
        f"Error occurred - Code: {error_code}, CorrelationID: {correlation_id}, "
        f"Exception: {str(exception)}, Context: {context}",
        extra={
            "correlation_id": correlation_id,
            "error_code": error_code,
            "exception_type": type(exception).__name__,
            "context": context
        },
        exc_info=True
    )