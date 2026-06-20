import axios from 'axios';
import { getId } from './constants';

const API = {
//  API_BASE_URL: process.env.API_BASE_URL
API_BASE_URL: 'http://localhost:3000'
};

const api = axios.create({
  baseURL: API.API_BASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  function (config) {
    const token = getId().qmetrixToken;
    if (token) {
      config.headers['qmetrix-token'] = token;
    }
    return config;
  },
  function (error) {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  function (response) {
    return response;
  },
  function (error) {
    return Promise.reject(error);
  },
);

export default api;
