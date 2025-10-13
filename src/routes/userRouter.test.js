const request = require('supertest');
const app = require('../service');
const { expectValidJwt, randomName, createAdminUser } = require('./testUtils');

let adminAuthToken;
let adminUser;


beforeAll(async () => {
    adminUser = await createAdminUser();
    const adminLoginRes = await request(app).put('/api/auth').send({
        email: adminUser.email,
        password: 'toomanysecrets'
    });
    adminAuthToken = adminLoginRes.body.token;
    expectValidJwt(adminAuthToken);
});

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const [user, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
});

test('delete user (mock filler)', async () => {
  const [user, token] = await registerUser(request(app));

  const res = await request(app)
    .delete('/api/user/2')
    .set('Authorization', 'Bearer ' + token);

  expect(res.status).toBe(200);
  expect(res.body.message).toMatch(/deleted/i);
});




async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

