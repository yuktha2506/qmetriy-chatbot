import express from 'express';
import userRoute from './user/route';
import companyRoute from './company/route';
import connectionRoute from './connection/route';
import jiraRoute from './project-management/jira/route';
import githubRoute from './source-code-management/github/route';
import gitlabRoute from './source-code-management/gitlab/route';
import cxoRoute from './cxo/route';
import testRailRoutes from './test-management/testrail/route';
import xrayRoutes from './test-management/xray/route';
import custumFieldRoutes from './project-management/custom-field/route';
import standUpRoutes from './stand-up-management/route';
import techQualityRoutes from './tech-Quality/route';
import analyticsRoute from './analytics/route';
import releaseDashboardRoutes from './release-dashboard/route';

const app = express();

app.use('/user', userRoute);
app.use('/company', companyRoute);
app.use('/connection', connectionRoute);
app.use('/jira', jiraRoute);
app.use('/github', githubRoute);
app.use('/gitlab', gitlabRoute);
app.use('/cxo', cxoRoute);
app.use('/testRail', testRailRoutes);
app.use('/xray', xrayRoutes);
app.use('/custumField', custumFieldRoutes);
app.use('/standup', standUpRoutes);
app.use('/techQuality', techQualityRoutes);
app.use('/analytics', analyticsRoute);
app.use('/releaseDashboard', releaseDashboardRoutes);

export default app;
