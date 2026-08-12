import { buildExtension } from './extension';

const globalSetup = async (): Promise<void> => {
  await buildExtension();
};

export default globalSetup;
