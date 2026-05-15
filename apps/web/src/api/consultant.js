import { get, post } from './helpers';

// Save validated plan output (called after SSE stream completes)
export const saveConsultantTask = (taskId, entityId, aiOutputJson) =>
  post(`/api/v1/consultant/tasks/${taskId}/save`, {
    task_id: taskId,
    entity_id: entityId,
    ai_output_json: aiOutputJson,
  });

// Get current plan status
export const getConsultantTaskStatus = (taskId, entityId) =>
  get(`/api/v1/consultant/tasks/${taskId}/status`, {
    params: { entity_id: entityId },
  });

// Send chat message to modify existing plan (reuse plan chat pattern)
export const sendConsultantChat = (taskId, entityId, message) =>
  post(`/api/v1/consultant/tasks/${taskId}/chat`, {
    entity_id: entityId,
    message,
  });
