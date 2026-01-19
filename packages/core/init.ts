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
import { getTimelineService } from '../projections/timeline';
import { getRewardsService } from '../projections/rewards';
import { getAnalyticsService } from '../projections/analytics';
import { getAIOrchestrator } from './ai-orchestrator';

/**
 * Initialize all background services
 */
export function initializeServices(): void {
  console.log('Initializing WellnessOS services...');
  
  // Start Event Bus processing
  startEventBusProcessing();
  console.log('✓ Event Bus processing started');
  
  // Initialize projection subscribers
  const timelineService = getTimelineService();
  timelineService.initialize();
  console.log('✓ Timeline projection initialized');
  
  const rewardsService = getRewardsService();
  rewardsService.initialize();
  console.log('✓ Rewards projection initialized');
  
  const analyticsService = getAnalyticsService();
  analyticsService.initialize();
  console.log('✓ Analytics projection initialized');
  
  const aiOrchestrator = getAIOrchestrator();
  aiOrchestrator.initialize();
  console.log('✓ AI Orchestrator initialized');
  
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
