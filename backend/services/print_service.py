from typing import Dict, Any, Optional
import asyncio
from datetime import datetime
import uuid
from enum import Enum

class PrintStatus(str, Enum):
    QUEUED = "queued"
    PRINTING = "printing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class PrintJob:
    def __init__(self, job_id: str, content: str, printer_name: str, job_type: str = "receipt"):
        self.id = job_id
        self.content = content
        self.printer_name = printer_name
        self.job_type = job_type
        self.status = PrintStatus.QUEUED
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.error_message = None

class PrintService:
    def __init__(self):
        self.print_queue = []
        self.print_history = []
        self.is_processing = False

    async def add_print_job(
        self,
        content: str,
        printer_name: str = "default",
        job_type: str = "receipt"
    ) -> str:
        """Add a new print job to the queue"""
        
        job_id = str(uuid.uuid4())
        job = PrintJob(job_id, content, printer_name, job_type)
        
        self.print_queue.append(job)
        
        # Start processing if not already running
        if not self.is_processing:
            asyncio.create_task(self._process_print_queue())
        
        return job_id

    async def _process_print_queue(self):
        """Process the print queue"""
        
        if self.is_processing:
            return
            
        self.is_processing = True
        
        try:
            while self.print_queue:
                job = self.print_queue.pop(0)
                await self._print_job(job)
                
        finally:
            self.is_processing = False

    async def _print_job(self, job: PrintJob):
        """Process a single print job"""
        
        try:
            job.status = PrintStatus.PRINTING
            job.updated_at = datetime.now()
            
            # Mock printing - in real implementation, this would send to actual printer
            await self._mock_bluetooth_print(job)
            
            job.status = PrintStatus.COMPLETED
            job.updated_at = datetime.now()
            
        except Exception as e:
            job.status = PrintStatus.FAILED
            job.error_message = str(e)
            job.updated_at = datetime.now()
        
        finally:
            # Move job to history
            self.print_history.append(job)
            
            # Keep only last 100 jobs in history
            if len(self.print_history) > 100:
                self.print_history = self.print_history[-100:]

    async def _mock_bluetooth_print(self, job: PrintJob):
        """Mock Bluetooth printing - replace with actual printer integration"""
        
        print(f"[PRINT MOCK] Printing job {job.id} to {job.printer_name}")
        print(f"[PRINT MOCK] Job type: {job.job_type}")
        print(f"[PRINT MOCK] Content length: {len(job.content)} characters")
        
        # Simulate printing delay
        await asyncio.sleep(2)
        
        print(f"[PRINT MOCK] Job {job.id} completed successfully")

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a print job"""
        
        # Check queue
        for job in self.print_queue:
            if job.id == job_id:
                return {
                    "id": job.id,
                    "status": job.status,
                    "created_at": job.created_at,
                    "updated_at": job.updated_at,
                    "printer_name": job.printer_name,
                    "job_type": job.job_type,
                    "error_message": job.error_message
                }
        
        # Check history
        for job in self.print_history:
            if job.id == job_id:
                return {
                    "id": job.id,
                    "status": job.status,
                    "created_at": job.created_at,
                    "updated_at": job.updated_at,
                    "printer_name": job.printer_name,
                    "job_type": job.job_type,
                    "error_message": job.error_message
                }
        
        return None

    def get_print_queue_status(self) -> Dict[str, Any]:
        """Get current print queue status"""
        
        return {
            "queue_length": len(self.print_queue),
            "is_processing": self.is_processing,
            "recent_jobs": [
                {
                    "id": job.id,
                    "status": job.status,
                    "job_type": job.job_type,
                    "created_at": job.created_at,
                    "updated_at": job.updated_at
                }
                for job in self.print_history[-10:]  # Last 10 jobs
            ]
        }

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a queued print job"""
        
        for i, job in enumerate(self.print_queue):
            if job.id == job_id:
                job.status = PrintStatus.CANCELLED
                job.updated_at = datetime.now()
                
                # Remove from queue and add to history
                cancelled_job = self.print_queue.pop(i)
                self.print_history.append(cancelled_job)
                
                return True
        
        return False

# Global print service instance
print_service = PrintService()