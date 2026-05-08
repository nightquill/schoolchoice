import client from '@schoolchoice/ui/api/client';

// Save validated plan output (called after SSE stream completes)
export const saveConsultantTask = (taskId, entityId, aiOutputJson) =>
  client.post(`/api/v1/consultant/tasks/${taskId}/save`, {
    task_id: taskId,
    entity_id: entityId,
    ai_output_json: aiOutputJson,
  }).then((r) => r.data);

// Get current plan status
export const getConsultantTaskStatus = (taskId, entityId) =>
  client.get(`/api/v1/consultant/tasks/${taskId}/status`, {
    params: { entity_id: entityId },
  }).then((r) => r.data);

// Send chat message to modify existing plan (reuse plan chat pattern)
export const sendConsultantChat = (taskId, entityId, message) =>
  client.post(`/api/v1/consultant/tasks/${taskId}/chat`, {
    entity_id: entityId,
    message,
  }).then((r) => r.data);
