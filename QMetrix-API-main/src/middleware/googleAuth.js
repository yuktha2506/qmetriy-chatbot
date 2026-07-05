import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserModel } from '../modules/user/model';
import connectionManager from '../config/connectionManager';
import { CompanyModel } from '../modules/company/model';

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.API_BASE_URL}/api/user/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const organizationName = profile.emails[0].value.split('@')[1];
                const [firstPart, secondPart] = organizationName.split('.');
                const capitalizedOrganizationName = firstPart.charAt(0).toUpperCase() + firstPart.slice(1) + '.' + secondPart;
                const metaConnection = connectionManager.connectToMetaDB();
                const Company = CompanyModel(metaConnection);
                const companyExists = await Company.findOne({ host: capitalizedOrganizationName });

                if (!companyExists) {
                    return done(null, true, { message: 'Company does not exist' });
                }

                const tenantConnection = connectionManager.getTenantConnection(companyExists.companyName, companyExists.databaseUri);
                const User = UserModel(tenantConnection);
                let user = await User.findOne({ email: profile.emails[0].value, isActive: true });

                if (!user) {
                    const hashedPassword = await bcrypt.hash('defaultPassword', 10);
                    user = await User.create({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        password: hashedPassword,
                        role: 'Admin',
                        companyName: companyExists?.companyName,
                        companyId: companyExists?._id,
                    });
                }

                const token = jwt.sign(
                    {
                        id: user.id,
                        email: user.email,
                        companyId: user.companyId,
                        status: user.status || 'active',
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );

                return done(null, { user, token });
            } catch (error) {
                return done(error, null);
            }
        }
    )
);
