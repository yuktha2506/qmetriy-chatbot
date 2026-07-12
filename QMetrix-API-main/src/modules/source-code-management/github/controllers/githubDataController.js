import { ProjectModel } from '../../../project-management/jira/model.js';
import { ConnectionModel } from '../../../connection/model.js';
import { BoardModel } from '../../../project-management/jira/model.js';
import GithubDataService from '../services/githubDataService.js';
import { Types } from 'mongoose';
import { PROVIDER_NAME_GITHUB } from '../../../../utils/constants/providerConstants.js';

class GithubDataController {
    async getGithubDetails(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const Connection = ConnectionModel(tenantConnection);
            const { repo } = req.body;
            const companyId = req.params.companyId;
            const cred = await Connection.findOne({ companyId, name: PROVIDER_NAME_GITHUB });
            const response = await GithubDataService.getGithubRepoData(cred, repo);
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getAllRepo(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const { companyId, projectId, boardId } = req.params;
            const Project = ProjectModel(tenantConnection);
            const Board = BoardModel(tenantConnection);

            // Validate board exists
            const board = await Board.findOne(
                {
                    _id: new Types.ObjectId(boardId),
                    companyId: new Types.ObjectId(companyId),
                    projectId: new Types.ObjectId(projectId),
                },
                { boardType: 1 }
            );

            if (!board) {
                return res.status(404).json({ error: 'Board not found.' });
            }

            const repos = await Project.findOne({ companyId, _id: projectId }, { repos: 1, _id: 0 });

            if (repos && repos.repos) {
                const repoNames = repos.repos.map((repo) => {
                    const name = repo.split('/');
                    return name[name.length - 1];
                });
                res.status(200).json(repoNames);
            } else {
                res.status(200).json([]);
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

export default new GithubDataController();
