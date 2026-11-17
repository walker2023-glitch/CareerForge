import { handleSuggestResume } from '../../../../lib/claude/resume-handlers';
import { createResumeDependencies } from '../../../../lib/resume/resume-adapter';
import { createModelCaller } from '../../../../lib/claude/model-caller';

export async function POST(request: Request): Promise<Response> {
  const deps = await createResumeDependencies();
  return handleSuggestResume(request, { ...deps, modelCaller: deps.canGenerate ? createModelCaller() : undefined });
}
