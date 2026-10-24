export type EventType = 'birthday' | 'anniversary' | 'new_joiners';

export interface Employee {
  name: string;
  sentence?: string;
  imageName?: string;
  id: string;
  imageUrl?: string;
  dob?: string;
  sequenceNumber?: number;
  empCode?: string;
  designation?: string;
  location?: string;
}

export interface AppState {
  employees: Employee[];
  status: 'idle' | 'processing' | 'done';
}
