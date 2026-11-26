import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type RoastConfigInput = {
  dir: string;
  finderPath: string;
  verifierPath: string;
  baseUrl: string;
  model: string;
};

function toYamlString(value: string): string {
  return JSON.stringify(value);
}

export function writeRoastConfig(input: RoastConfigInput): string {
  mkdirSync(input.dir, { recursive: true });
  const path = join(input.dir, "config.yaml");
  const body = `version: 1
inference_profiles:
  commandcode:
    endpoint: ${toYamlString(input.baseUrl)}
    protocol: chat
    model: ${toYamlString(input.model)}
    api_key_env: REVIEW_API_KEY
    max_output_tokens: 65536
roles:
  finder:
    profile: commandcode
  verifier:
    profile: commandcode
prompts:
  finder_code: ${toYamlString(input.finderPath)}
  verifier: ${toYamlString(input.verifierPath)}
review:
  confidence_floor: 0.65
`;
  writeFileSync(path, body, { mode: 0o600 });
  return path;
}
