const request = require('supertest');
const app = require('../service');
// const { expectValidJwt, createAdminUser } = require('./testUtils');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

const { Role, DB } = require('../database/database.js');

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('register success', async() => {
    const registerRes = await request(app).post('/api/auth').send(testUser);
    expect(registerRes.status).toBe(200);
    expect(registerRes.body.user.name).toBe('pizza diner');
    expectValidJwt(registerRes.body.token);
});

test('login success', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('logout unauthorized', async () => {
    const res = await request(app).delete('/api/auth');
    expect(res.status).toBe(401);

});

test('register unsuccessful', async () => {
    const res = await request(app).post('/api/auth').send({email: "no@test.com"});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('name, email, and password are required');
});

test('logout successful', async() => {
    const res = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('logout successful');
});


function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

//middleware helpers
// middleware helpers
test('authenticated request with valid token succeeds (logout as example)', async () => {
  const adminUser = await createAdminUser();

  // login admin
  const loginRes = await request(app)
    .put('/api/auth')
    .send({ email: adminUser.email, password: 'toomanysecrets' });

  const adminToken = loginRes.body.token;

  // call logout with valid token (this hits authenticateToken + clearAuth)
  const res = await request(app)
    .delete('/api/auth')
    .set('Authorization', `Bearer ${adminToken}`);

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ message: 'logout successful' });
});

