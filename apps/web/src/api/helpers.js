import client from '@schoolchoice/ui/api/client';

export const get = (url, config) => client.get(url, config).then(r => r.data);
export const post = (url, data, config) => client.post(url, data, config).then(r => r.data);
export const put = (url, data, config) => client.put(url, data, config).then(r => r.data);
export const patch = (url, data, config) => client.patch(url, data, config).then(r => r.data);
export const del = (url, config) => client.delete(url, config).then(r => r.data);
// Re-export raw client for special cases (FormData, blob responses)
export { client };
