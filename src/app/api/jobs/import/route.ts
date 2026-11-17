import { handleImportJob } from '../../../../lib/jobs/private-job-handlers';
import { createJobDependencies } from '../../../../lib/jobs/job-adapter';

export async function POST(request: Request): Promise<Response> {
  return handleImportJob(request, await createJobDependencies());
}
