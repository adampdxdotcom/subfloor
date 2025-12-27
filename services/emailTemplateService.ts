import axios from 'axios';
import { getEndpoint } from '../utils/apiConfig';
import { EmailTemplate } from '../types';

const getOptions = () => ({
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

export const emailTemplateService = {
  getAll: async (): Promise<EmailTemplate[]> => {
    const response = await axios.get(
        getEndpoint('/api/email-templates'), 
        getOptions()
    );
    return response.data;
  },

  getByKey: async (key: string): Promise<EmailTemplate> => {
    const response = await axios.get(
        getEndpoint(`/api/email-templates/${key}`), 
        getOptions()
    );
    return response.data;
  },

  update: async (key: string, data: { subject: string; body_content: string | null }): Promise<EmailTemplate> => {
    const response = await axios.put(
        getEndpoint(`/api/email-templates/${key}`), 
        data, 
        getOptions()
    );
    return response.data;
  },

  sendTest: async (key: string, email: string): Promise<void> => {
    await axios.post(
        getEndpoint(`/api/email-templates/${key}/test`), 
        { email }, 
        getOptions()
    );
  }
};