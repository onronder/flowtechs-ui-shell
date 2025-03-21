
// Dataset Diff types
export interface DatasetDiff {
  addedRecords: number;
  removedRecords: number;
  changedRecords: number;
  unchangedRecords: number;
  changes: RecordChange[];
}

export interface RecordChange {
  id: string;
  changeType: 'added' | 'removed' | 'changed';
  path?: string[];
  oldValue?: any;
  newValue?: any;
}
