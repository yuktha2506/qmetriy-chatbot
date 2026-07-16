import { buildChurnHelpers, computeChurnData } from './storyChurnLogic.js';

export default async function storyChurnExcludingBugsLogic({ ctx, builder, params }) {
    const { standupPageRole } = params;
    const role = (standupPageRole && typeof standupPageRole === 'string')
        ? standupPageRole.replace(/^['"]|['"]$/g, '')
        : 'team';

    const board = ctx.board;
    const members = board?.assignees || [];
    const helpers = buildChurnHelpers(board, members, role);

    if (builder.sprintId) {
        const sprints = await builder.getLastSixSprints();
        if (!sprints || sprints.length === 0) {return { storyChurn: { message: 'No sprints found' } };}
        return { storyChurn: computeChurnData(sprints, 'name', 'storyChurn', helpers, role, true) };
    } else if (builder.releaseId) {
        const releases = await builder.getLastSixReleases();
        if (!releases || releases.length === 0) {return { storyChurn: { message: 'No releases found' } };}
        return { storyChurn: computeChurnData(releases, 'releaseName', 'releaseChurn', helpers, role, true) };
    }

    return { storyChurn: null };
}
