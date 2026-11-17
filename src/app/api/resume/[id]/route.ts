import { handleGetResume, handlePatchResume } from '../../../../lib/claude/resume-handlers';
import { createResumeDependencies } from '../../../../lib/resume/resume-adapter';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return handleGetResume((await params).id, await createResumeDependencies());
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return handlePatchResume((await params).id, request, await createResumeDependencies());
}
