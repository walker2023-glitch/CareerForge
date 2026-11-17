import { handleGetJob } from '../../../../lib/jobs/private-job-handlers';
import { createJobDependencies } from '../../../../lib/jobs/job-adapter';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handleGetJob(id, await createJobDependencies());
}
