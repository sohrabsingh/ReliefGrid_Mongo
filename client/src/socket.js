import { io } from 'socket.io-client';
import { api } from './api.js';

// One shared connection for the whole app - components subscribe/unsubscribe to
// individual event names, they never open their own socket.
export const socket = io(api.API_URL, { autoConnect: true });
