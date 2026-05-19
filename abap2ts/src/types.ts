export type AbapObjectType = string; // PROG | CLAS | INTF | FUNC | BADI | CDS | BDEF | TABL | STRU | DTEL | DOMA | TTYP | VIEW | ...

export interface AbapField {
  name: string;
  type: string;
  length?: number;
  decimals?: number;
  description?: string;
  required?: boolean;
}

export interface AbapParameter {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
}

export interface AbapMethod {
  name: string;
  importing?: AbapParameter[];
  exporting?: AbapParameter[];
  changing?: AbapParameter[];
  returning?: AbapParameter;
  exceptions?: string[];
  description?: string;
}

export interface AbapObjectContext {
  name: string;
  type: AbapObjectType;
  description?: string;
  fields?: AbapField[];
  methods?: AbapMethod[];
  references?: string[]; // names of other ABAP objects this one depends on
  metadata: Record<string, unknown>; // raw data from sap-abap skill
  addedAt: Date;
}

export interface DependencyNode {
  name: string;
  type: string;
  dependsOn: string[];
  dependedBy: string[];
}

export interface AnalysisResult {
  objectCount: number;
  dependencyGraph: Record<string, DependencyNode>;
  generationOrder: string[];
  summary: string;
}

export interface GenerateOptions {
  objectName: string;
  templateName?: string;
  outputDir?: string;
}

export interface GenerateResult {
  objectName: string;
  outputPath: string;
  content: string;
}
