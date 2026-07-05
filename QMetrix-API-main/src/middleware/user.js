import 'dotenv/config';
import { verify } from 'jsonwebtoken';

class UserMiddleware {
    varifyToken(req, res, next) {
        const token = req.headers.authorization;
        if (!token) {
            res.status(401).send({ auth: false, message: 'No token provided' });
        } else {
            verify(token, process.env.JWT_SECRET, (err) => {
                if (err) {
                    res.status(401).json({ auth: false, message: 'Failed to authenticate token', error: err });
                } else {
                    // eslint-disable-next-line callback-return
                    next();
                }
            });
        }
    }

}

export default UserMiddleware;
