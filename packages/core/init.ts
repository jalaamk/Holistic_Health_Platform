/**
 * Application Initialization
 * Starts background services and workers
 * 
 * Call this on application startup to:
 * - Start Event Bus processing
 * - Initialize background jobs
 * - Set up system-wide services
 */

import { startEventBusProcessing, stopEventBusProcessing } from './event-bus';

/**
 * Initialize all background services
 */
export function initializeServices(): void {
  console.log('Initializing WellnessOS services...');
  
  // Start Event Bus processing
  startEventBusProcessing();
  console.log('✓ Event Bus processing started');
  
  // Future: Add other service initializations
  // - Background job schedulers
  // - Cache warming
  // - Metrics collection
  
  console.log('✓ All services initialized');
}

/**
 * Graceful shutdown of services
 */
export function shutdownServices(): void {
  console.log('Shutting down WellnessOS services...');
  
  // Stop Event Bus processing
  stopEventBusProcessing();
  console.log('✓ Event Bus processing stopped');
  
  console.log('✓ All services shut down');
}
