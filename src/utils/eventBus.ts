import mitt, { type Emitter } from 'mitt';

export type Events = {
  'toast:show': {
    message: string;
    type: 'default' | 'error' | 'success';
    duration?: number;
  };
  'toast:hide': void;
};

const eventBus: Emitter<Events> = mitt<Events>();

export default eventBus;
