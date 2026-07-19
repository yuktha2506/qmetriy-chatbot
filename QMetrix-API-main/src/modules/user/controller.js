import 'dotenv/config';
import { sign, verify } from 'jsonwebtoken';
import { CompanyModel } from '../company/model.js';
import { UserModel } from './model.js';
import bcrypt from 'bcrypt';
import connectionManager from '../../config/connectionManager.js';
import nodemailer from 'nodemailer';
import { ProjectModel, SprintModel, BoardModel, JiraReleaseModel } from '../project-management/jira/model.js';
import { linkedCompanies } from '../../utils/trigent_linkedCompanies.js';
import { Types } from 'mongoose';

async function fetchNavigationData(tenantConnection, metaConnection, companyExists, companyId) {
    const navigationData = { status: 'failed', error: null };
    try {
        const Project = ProjectModel(tenantConnection);
        const Board = BoardModel(tenantConnection);
        const Sprint = SprintModel(tenantConnection);
        const JiraRelease = JiraReleaseModel(tenantConnection);
        const MetaCompany = CompanyModel(metaConnection);

        const [projectList, allOrgs] = await Promise.all([
            Project.find({}, {
                _id: 1, name: 1, key: 1, repos: 1, boardType: 1, boardId: 1,
                isSelected: 1, hideStatus: 1, estimation: 1, metricContribution: 1,
                combinedScanData: 1, projectTypeKey: 1, self: 1,
                syncStatus: 1, hardSyncStatus: 1, lastSynced: 1,
            }).lean(),
            (async () => {
                const orgs = [];
                const { companyName } = companyExists;
                if (companyName === 'Trigent' || companyName === 'Trinav') {
                    for (const lc of linkedCompanies) {
                        const linked = await MetaCompany.findOne({ companyName: lc }).lean();
                        if (linked) {
                            orgs.push({ companyName: linked.companyName, _id: linked._id });
                        }
                    }
                }
                return orgs;
            })(),
        ]);

        if (!projectList || projectList.length === 0) {
            navigationData.error = 'No projects found for this company';
            return navigationData;
        }

        navigationData.projectList = projectList;
        navigationData.allOrgs = allOrgs;
        navigationData.companyName = companyExists.companyName;

        const defaultProject = projectList.find(
            (p) => p.isSelected && p.hideStatus === false
        ) || projectList[0];

        const companyObjectId = new Types.ObjectId(companyId);
        const projectObjectId = new Types.ObjectId(defaultProject._id);

        const allBoards = await Board.find({
            companyId: companyObjectId,
            projectId: projectObjectId,
        }, {
            _id: 1, boardId: 1, boardName: 1, boardType: 1,
        }).lean();

        const matchingBoards = [];
        const remainingBoards = [];
        allBoards.forEach((board) => {
            if (board.boardId === defaultProject.boardId) {
                matchingBoards.push(board);
            } else {
                remainingBoards.push(board);
            }
        });
        const boardList = [...matchingBoards, ...remainingBoards];

        navigationData.defaultProject = {
            projectId: defaultProject._id.toString(),
            projectName: defaultProject.name,
            lastSynced: defaultProject.lastSynced || null,
            syncStatus: defaultProject.syncStatus ?? null,
            boardList,
            defaultBoard: null,
        };

        const defaultBoard = boardList[0];
        if (defaultBoard) {
            const boardId = defaultBoard._id;
            const boardType = (defaultBoard.type || defaultBoard.boardType || '').toLowerCase();

            const [sprintList, releaseList] = await Promise.all([
                Sprint.find({
                    projectId: projectObjectId,
                    boardId: new Types.ObjectId(boardId),
                }, {
                    _id: 1, name: 1, state: 1, sprintId: 1, projectId: 1,
                    startDate: 1, endDate: 1, completeDate: 1, totalStoryPoints: 1,
                    committedVsCompletedMetrics: 1, velocity: 1, assignees: 1, hours: 1,
                }).lean(),
                JiraRelease.find({
                    companyId: companyId.toString(),
                    projectId: defaultProject._id.toString(),
                    boardId: boardId.toString(),
                }, {
                    _id: 1, releaseName: 1, status: 1, releaseDate: 1, startDate: 1,
                    overdue: 1, totalStoryPoints: 1, committedVsCompletedMetrics: 1,
                    velocity: 1, assignees: 1, hours: 1, projectId: 1,
                }).lean(),
            ]);

            const repoList = (defaultProject.repos || []).map((repo) => {
                const parts = repo.split('/');
                return parts[parts.length - 1];
            });

            navigationData.defaultProject.defaultBoard = {
                boardId: boardId.toString(),
                boardName: defaultBoard.name || defaultBoard.boardName || '',
                boardType,
                sprintList,
                releaseList,
                repoList,
            };
        }

        navigationData.status = 'success';
    } catch (error) {
        console.error('Error fetching navigation data:', error);
        navigationData.error = `Navigation data fetch failed: ${error.message}`;
    }
    return navigationData;
}

class UserController {
    async getUser(req, res) {
        try {
            const tenantConnection = req.tenantConnection;
            const User = UserModel(tenantConnection);
            const user = await User.find({});
            if (user) {
                res.status(200).json(user);
            } else {
                res.status(404).json({ message: 'User not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async register(req, res) {
        try {
            const body = req.body;

            if (!body || !body.email) {
                return res.status(400).json({ error: 'Email is required.' });
            }

            const metaConnection = connectionManager.connectToMetaDB();
            const Company = CompanyModel(metaConnection);
            const { email, password } = body;

            if (!password) {
                return res.status(400).json({ error: 'Password is required.' });
            }

            const organizationName = email.split('@')[1];
            if (!organizationName || !organizationName.includes('.')) {
                return res.status(400).json({ error: 'Invalid email format.' });
            }

            const [firstPart, secondPart] = organizationName.split('.');
            const capitalizedOrganizationName = firstPart.charAt(0).toUpperCase() + firstPart.slice(1) + '.' + secondPart;

            const companyExists = await Company.findOne({ host: capitalizedOrganizationName });
            if (!companyExists) {
                return res.status(404).json({ error: 'Company does not exist.', redirectUrl: '/addCompany' });
            }

            const tenantConnection = connectionManager.getTenantConnection(companyExists.companyName, companyExists.databaseUri);
            const User = UserModel(tenantConnection);

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(200).json({ message: 'User is already registered.', user: existingUser, redirectUrl: '/login' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = new User({
                ...body,
                password: hashedPassword,
                companyId: companyExists._id,
                companyName: companyExists.companyName,
            });
            const data = await newUser.save();

            const MetaUser = UserModel(metaConnection);
            const metaUser = new MetaUser({
                ...body,
                password: hashedPassword,
                companyId: companyExists._id,
                companyName: companyExists.companyName,
            });
            const userMetaData = await metaUser.save();

            const obj = { id: data._id, email: data.email };
            const token = sign(obj, process.env.JWT_SECRET || 'default_secret', {
                expiresIn: '24h',
            });

            res.status(201).json({
                id: data._id,
                email: data.email,
                name: data.name,
                companyId: data.companyId,
                role: data.role,
                token,
                userMetaDataCompany: userMetaData.companyName,
            });
        } catch (error) {
            console.error('Error during registration:', error.message);
            res.status(500).json({ error: 'Internal server error.' });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required',
                });
            }

            const organizationName = email.split('@')[1];
            if (!organizationName || !organizationName.includes('.')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid organization domain',
                });
            }

            const [firstPart, secondPart] = organizationName.split('.');
            const capitalizedOrganizationName =
            firstPart.charAt(0).toUpperCase() + firstPart.slice(1) + '.' + secondPart;
            const metaConnection = connectionManager.connectToMetaDB();
            const Company = CompanyModel(metaConnection);
            const companyExists = await Company.findOne({ host: capitalizedOrganizationName });
            if (!companyExists) {
                return res.status(404).json({
                    success: false,
                    message: 'Company does not exist',
                    redirectUrl: '/addCompany',
                });
            }
            const tenantConnection = connectionManager.getTenantConnection(
                companyExists.companyName,
                companyExists.databaseUri
            );
            const User = UserModel(tenantConnection);
            if (tenantConnection.readyState === 1) {
                console.log('Tenant DB connection is OPEN');
            } else {
                console.log(' Tenant DB connection state:', tenantConnection.readyState);
            }
            const user = await User.findOne({
                email: new RegExp(`^${email}$`, 'i'), 
                isActive: true
            }).lean();

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User is not registered or inactive.',
                    redirectUrl: '/register',
                });
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid password. Please try again.',
                });
            }

            const tokenPayload = { id: user._id, email: user.email };
            const token = sign(tokenPayload, process.env.JWT_SECRET, {
                expiresIn: '24h',
            });

            const navigationData = await fetchNavigationData(
                tenantConnection, metaConnection, companyExists, user.companyId
            );

            return res.status(200).json({
                success: true,
                message: 'Login successful',
                data: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    companyId: user.companyId,
                    role: user.role,
                    token: token,
                    navigationData,
                },
                redirectUrl: '/dashboard',
            });

        } catch (error) {
            console.error(error.stack);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
            });
        }
    }

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required',
                });
            }
            const organizationName = email.split('@')[1];
            const [firstPart, secondPart] = organizationName.split('.');
            const capitalizedOrganizationName = firstPart.charAt(0).toUpperCase() + firstPart.slice(1) + '.' + secondPart;
            const metaConnection = connectionManager.connectToMetaDB();
            const Company = CompanyModel(metaConnection);
            const companyExists = await Company.findOne({ host: capitalizedOrganizationName });

            if (!companyExists) {
                return res.status(404).json({
                    success: false,
                    message: 'Company does not exist',
                    redirectUrl: '/addCompany',
                });
            }

            const tenantConnection = connectionManager.getTenantConnection(companyExists.companyName, companyExists.databaseUri);
            const User = UserModel(tenantConnection);
            const user = await User.findOne({ email, isActive: true });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User is not registered.',
                    redirectUrl: '/register',
                });
            }
            const token = sign(
                {
                    user: user._id,
                    email: user.email,
                },
                process.env.RESET_PASSWORD_SECRET_KEY,
                { expiresIn: '30m' }
            );
            const userName = user.name
                ? user.name
                    .trim()
                    .split(' ')
                    .filter((word) => word.length > 0)
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ')
                : 'User';
    
            const transporter = nodemailer.createTransport({
                host: process.env.NODE_SENDER_MAIL_ID_HOST,
                port: 587,
                secure: false,
                auth: {
                    user: process.env.NODE_SENDER_MAIL_USER,
                    pass: process.env.NODE_SENDER_MAIL_PASS,
                },
            });

            const mailOptions = {
                from: process.env.NODE_SENDER_MAIL_ID,
                to: user.email,
                subject: 'Reset Your Password - Action Required',
                // eslint-disable-next-line max-len
                text: `Hi ${userName},\n\nWe received a request to reset your password for your account associated with this email address.\n\nTo reset your password, click on the link below:\n\n${process.env.ALLOWED_ORIGIN}/resetPassword/${token}\n\nIf you did not request this, please ignore this email. This link will expire in 30 minutes.\n\nBest regards,\nQMetry360 Support Team`,
                html: `
                <div style="font-family: Arial, sans-serif;">
                    <p>Hi <b>${userName}</b>,</p>
                    <p>We received a request to reset your password for your account associated with this email address.</p>
                    <p>To reset your password, please click on the "Reset Password" below:</p>
                    <p>
                    <a href="${process.env.ALLOWED_ORIGIN}/resetPassword/${token}" 
                    style="background-color: #7367F0; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; display: inline-block;">Reset Password</a></p>
                    <p>If you did not request a password reset, please ignore this email. This link will expire in 30 minutes for security reasons.</p>
                    <p>If you need any help, feel free to contact our support team.</p>
                    <p>Best regards,<br><b>QMetry360 Support Team</b></p>
                </div>
                `,
            };

            transporter.sendMail(mailOptions, function (error) {
                if (error) {
                    console.error('Error sending mail:', error);
                    return res.status(500).json({
                        success: false,
                        message: 'Error sending mail',
                        error: error.message,
                    });
                } else {
                    return res.json({
                        status: true,
                        message: 'Reset email has been successfully sent to your email.',
                    });
                }
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    async resetPassword(req, res) {
        try {
            const { token } = req.params;
            const { password } = req.body;
            if (!password) {
                return res.status(400).send({ message: 'Password not found' });
            }

            let decode;
            try {
                decode = verify(token, process.env.RESET_PASSWORD_SECRET_KEY);
            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    return res.status(401).json({
                        success: false,
                        message: 'Password reset link has expired. Please request a new one.',
                        redirectUrl: '/forgotPassword',
                    });
                }
                return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
            }
            const { email } = decode;

            const organizationName = email.split('@')[1];
            if (!organizationName || !organizationName.includes('.')) {
                return res.status(400).json({ error: 'Invalid email format.' });
            }

            const [firstPart, secondPart] = organizationName.split('.');
            const capitalizedOrganizationName = firstPart.charAt(0).toUpperCase() + firstPart.slice(1) + '.' + secondPart;

            const metaConnection = connectionManager.connectToMetaDB();
            const Company = CompanyModel(metaConnection);
            const companyExists = await Company.findOne({ host: capitalizedOrganizationName });

            if (!companyExists) {
                return res.status(404).json({ message: 'Company does not exist' });
            }

            const tenantConnection = connectionManager.getTenantConnection(companyExists.companyName, companyExists.databaseUri);
            const User = UserModel(tenantConnection);
            const user = await User.findOne({ email: decode.email });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const isSamePassword = await bcrypt.compare(password, user.password);
            if (isSamePassword) {
                return res.status(400).json({
                    message: 'New password cannot be the same as the old password',
                    error: true,
                    success: false,
                });
            }

            const salt = bcrypt.genSaltSync(10);
            const hashPassword = await bcrypt.hashSync(password, salt);

            user.password = hashPassword;
            await user.save();

            res.status(200).json({
                message: 'Password successfully reset',
                error: false,
                success: true,
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

export default new UserController();
