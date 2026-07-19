import { Router } from 'express';
import userController from './controller';
import passport from 'passport';
import UserMiddleware from '../../middleware/user.js';

class UserRoutes {
    constructor() {
        this.router = Router();
        this.user = new UserMiddleware();
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.post('/register', userController.register);
        this.router.post('/login', userController.login);
        this.router.post('/forgotPassword', userController.forgotPassword);
        this.router.post('/resetPassword/:token', userController.resetPassword);
        this.router.get('/', this.user.varifyToken, userController.getUser);
        this.router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
        this.router.get('/auth/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
            const { token, user } = req.user;
            const companyId = user?.companyId;

            if (!companyId) {
                return res.redirect(`${process.env.UI_BASE_URL}/addCompany`);
            }

            const redirectURL = `${process.env.UI_BASE_URL}?token=${token}&companyId=${companyId}&username=${user.name}&useremail=${user.email}`;
            res.redirect(redirectURL);
        });
    }
}

export default new UserRoutes().router;
