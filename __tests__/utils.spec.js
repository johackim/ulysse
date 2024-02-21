import fs from 'fs';
import childProcess from 'child_process';
import { DEFAULT_CONFIG } from '../src/constants';
import {
    readConfig,
    editConfig,
    createConfig,
    getTimeType,
    createTimeout,
    getRunningApps,
    isValidDistraction,
    isDistractionBlocked,
} from '../src/utils';

const TEST_CONFIG_PATH = '/tmp/config.json';

beforeEach(() => {
    jest.spyOn(childProcess, 'execSync').mockImplementation(() => {});
    if (fs.existsSync(TEST_CONFIG_PATH)) {
        fs.unlinkSync(TEST_CONFIG_PATH);
    }
});

test('Should create a config file', async () => {
    const config = { blocklist: [], whitelist: [] };

    createConfig(config, TEST_CONFIG_PATH);

    expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(true);
    expect(fs.readFileSync(TEST_CONFIG_PATH, 'utf8')).toBe(JSON.stringify(config, null, 4));
});

test('Should read config file', async () => {
    createConfig({ blocklist: [], whitelist: [] }, TEST_CONFIG_PATH);

    const config = readConfig(TEST_CONFIG_PATH);

    expect(config).toEqual({ blocklist: [], whitelist: [] });
});

test('Should check distraction value', async () => {
    expect(isValidDistraction({ name: '' })).toBe(false);
    expect(isValidDistraction({ name: '*' })).toBe(false);
    expect(isValidDistraction({ name: '*.*' })).toBe(true);
    expect(isValidDistraction({ name: '*.example.com' })).toBe(true);
    expect(isValidDistraction({ name: 'example.com' })).toBe(true);
    expect(isValidDistraction({ name: 'chromium' })).toBe(true);
    expect(isValidDistraction({ name: 'chromium', time: 'badtime' })).toBe(false);
    expect(isValidDistraction({ name: 'chromium', time: '1m' })).toBe(true);
    expect(isValidDistraction({ name: 'inexistent' })).toBe(false);
});

test('Should add a distraction to blocklist', async () => {
    const distraction = { name: 'example.com' };
    editConfig({ ...DEFAULT_CONFIG, blocklist: [distraction] }, TEST_CONFIG_PATH);

    const config = readConfig(TEST_CONFIG_PATH);
    expect(config.blocklist).toEqual(expect.arrayContaining([distraction]));
});

test('Should remove a distraction from blocklist', async () => {
    const distraction = { name: 'example.com' };
    createConfig({ ...DEFAULT_CONFIG, blocklist: [distraction] }, TEST_CONFIG_PATH);

    editConfig({ blocklist: [] }, TEST_CONFIG_PATH);

    const config = readConfig(TEST_CONFIG_PATH);
    expect(config.blocklist).toEqual(expect.arrayContaining([]));
});

test('Should not remove a distraction from blocklist if shield mode is enabled', async () => {
    const distraction = { name: 'example.com' };
    createConfig({ ...DEFAULT_CONFIG, blocklist: [distraction], shield: true }, TEST_CONFIG_PATH);

    editConfig({ blocklist: [] }, TEST_CONFIG_PATH);

    const config = readConfig(TEST_CONFIG_PATH);
    expect(config.shield).toBe(true);
    expect(config.blocklist).toEqual(expect.arrayContaining([distraction]));
});

test('Should not whitelist a distraction if shield mode is enabled', async () => {
    const distraction = { name: 'example.com' };
    createConfig({ ...DEFAULT_CONFIG, shield: true }, TEST_CONFIG_PATH);

    editConfig({ whitelist: [distraction] }, TEST_CONFIG_PATH);

    const config = readConfig(TEST_CONFIG_PATH);
    expect(config.shield).toBe(true);
    expect(config.whitelist).toEqual(expect.arrayContaining([]));
});

test('Should enable shield mode', async () => {
    const passwordHash = 'd97e609b03de7506d4be3bee29f2431b40e375b33925c2f7de5466ce1928da1b';

    editConfig({ shield: true, passwordHash }, TEST_CONFIG_PATH);

    const config = readConfig(TEST_CONFIG_PATH);
    expect(config.shield).toBe(true);
    expect(config.passwordHash).toBe(passwordHash);
});

test('Should disable shield mode', async () => {
    const passwordHash = 'd97e609b03de7506d4be3bee29f2431b40e375b33925c2f7de5466ce1928da1b';
    createConfig({ ...DEFAULT_CONFIG, passwordHash, shield: true }, TEST_CONFIG_PATH);

    editConfig({ shield: false, password: 'ulysse' }, TEST_CONFIG_PATH);

    const config = readConfig(TEST_CONFIG_PATH);
    expect(config.shield).toBe(false);
});

test('Should not disable shield mode if password is wrong', async () => {
    const passwordHash = 'd97e609b03de7506d4be3bee29f2431b40e375b33925c2f7de5466ce1928da1b';
    createConfig({ ...DEFAULT_CONFIG, passwordHash, shield: true }, TEST_CONFIG_PATH);

    editConfig({ shield: false, password: 'badpassword' }, TEST_CONFIG_PATH);

    const config = readConfig(TEST_CONFIG_PATH);
    expect(config.shield).toBe(true);
});

test('Should get all running apps', async () => {
    const apps = getRunningApps();

    expect(JSON.stringify(apps)).toContain('node');
});

test('Should create a timeout incremented by a duration', async () => {
    const timestamp = 1704063600;
    expect(createTimeout('30m', timestamp)).toBe(1704065400);
    expect(createTimeout('2h', timestamp)).toBe(1704070800);
    expect(createTimeout('1h59m', timestamp)).toBe(1704070740);
    expect(createTimeout('1d', timestamp)).toBe(1704150000);
    expect(createTimeout('1m', timestamp)).toBe(1704063660);
});

test('Should get duration time type', () => {
    expect(getTimeType('1d')).toBe('duration');
    expect(getTimeType('30m')).toBe('duration');
    expect(getTimeType('1h30m')).toBe('duration');
    expect(getTimeType('10h-18h')).toBe('interval');
});

test('Should block a specific subdomain', async () => {
    const config = { blocklist: [{ name: 'www.example.com' }], whitelist: [] };
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(config));

    expect(isDistractionBlocked('www.example.com')).toBe(true);
    expect(isDistractionBlocked('example.com')).toBe(false);
});

test('Should block a distraction with a time-based interval', async () => {
    const config = { blocklist: [{ name: 'example.com', time: '0h-23h' }], whitelist: [] };
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(config));

    const isBlocked = isDistractionBlocked('example.com');

    expect(isBlocked).toBe(true);
});

test('Should block all subdomains of a domain with a wildcard', async () => {
    const config = { blocklist: [{ name: '*.example.com' }], whitelist: [] };
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(config));

    const isBlocked = isDistractionBlocked('example.com');

    expect(isBlocked).toBe(true);
});

test('Should block all subdomains of a domain with a time-based interval', async () => {
    const config = { blocklist: [{ name: '*.example.com', time: '0h-23h' }], whitelist: [] };
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(config));

    const isBlocked = isDistractionBlocked('example.com');

    expect(isBlocked).toBe(true);
});

test('Should block all domains with *.*', async () => {
    const config = { blocklist: [{ name: '*.*' }], whitelist: [] };
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(config));

    const isBlocked = isDistractionBlocked('example.com');

    expect(isBlocked).toBe(true);
});

test('Should block all domains with *.* except for the whitelist', async () => {
    const config = { blocklist: [{ name: '*.*' }], whitelist: [{ name: 'www.example.com' }] };
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(config));

    const isBlocked = isDistractionBlocked('www.example.com');

    expect(isBlocked).toBe(false);
});

test('Shoud not block apps if *.* is in the blocklist', async () => {
    const config = { blocklist: [{ name: '*.*' }], whitelist: [] };
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(config));

    const isBlocked = isDistractionBlocked('chromium');

    expect(isBlocked).toBe(false);
});

test('Should not block a domain if it is in the whitelist with a wildcard', async () => {
    const config = { blocklist: [{ name: '*.*' }], whitelist: [{ name: '*.example.com' }] };
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => JSON.stringify(config));

    const isBlocked = isDistractionBlocked('www.example.com');

    expect(isBlocked).toBe(false);
});

test('Should remove a distraction from blocklist if timeout is reached and shield mode is enabled', async () => {
    editConfig({
        shield: true,
        blocklist: [{ name: 'chromium' }, { name: '*.*', timeout: 1708617136 }],
        passwordHash: 'd97e609b03de7506d4be3bee29f2431b40e375b33925c2f7de5466ce1928da1b',
    }, TEST_CONFIG_PATH);

    editConfig({ blocklist: [{ name: 'chromium' }] }, TEST_CONFIG_PATH);

    expect(readConfig(TEST_CONFIG_PATH).blocklist).toEqual([{ name: 'chromium' }]);
});
