import axios from 'axios';
import { cryptoHandler } from '../../../../utils/commonFunctions';

class GithubDataService {
    async getGithubRepoData(cred, repo) {
        try {
            const decryptedPassword = cryptoHandler(cred.password, 'decrypt');
            const response = await axios.get(`https://api.github.com/repos/${cred.host}/${repo}`, {
                headers: {
                    Authorization: `Bearer ${decryptedPassword}`,
                },
            });
            return response.data;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

export default new GithubDataService();
