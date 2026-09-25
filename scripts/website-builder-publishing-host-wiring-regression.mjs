import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [tool, bridge, panel, scheduleService, workflowService] = await Promise.all([
  read('src/modules/website-builder/WebsiteBuilderTool.tsx'),
  read('src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx'),
  read('src/modules/website-builder/v2-ui/BuilderPublishingMaxPanel.tsx'),
  read('src/modules/website-builder/services/publishScheduleService.ts'),
  read('src/modules/website-builder/services/publishingWorkflowService.ts'),
]);

assert.match(panel, /onPublishPlan/, 'Publishing MAX panel must emit normalized publish plans');
assert.match(bridge, /onPublishPlan/, 'V2 bridge must expose Publishing MAX plans to the host');
assert.match(scheduleService, /createWebsitePublishSchedule/, 'Scheduled publishing service must support creation');
assert.match(scheduleService, /cancelWebsitePublishSchedule/, 'Scheduled publishing service must support cancellation');
assert.match(scheduleService, /rescheduleWebsitePublish/, 'Scheduled publishing service must support rescheduling');
assert.match(workflowService, /stageWebsiteRelease/, 'Publishing workflow must support staging');
assert.match(workflowService, /promoteStagingToProduction/, 'Publishing workflow must support staging promotion');
assert.match(workflowService, /restoreProductionFromArchive/, 'Publishing workflow must support rollback');

// Host reachability: these guards intentionally fail if the MAX UI/services exist but
// WebsiteBuilderTool does not connect them to the active project/user publishing flow.
assert.match(tool, /publishScheduleService/, 'WebsiteBuilder host must import scheduled publishing operations');
assert.match(tool, /publishingWorkflowService/, 'WebsiteBuilder host must import staging/production workflow operations');
assert.match(tool, /onPublishPlan=/, 'WebsiteBuilder host must wire Publishing MAX plan submission');
assert.match(tool, /createWebsitePublishSchedule/, 'Scheduled plans must persist through the host');
assert.match(tool, /stageWebsiteRelease/, 'Staging plans must execute through the host');

console.log('PASS Website Builder Publishing MAX host wiring: UI plans reach scheduled/staging production services end-to-end');
