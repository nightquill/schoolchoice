import client from '@schoolchoice/ui/api/client';

export const getAlerts = () => client.get('/api/v1/alerts').then((r) => r.data);
