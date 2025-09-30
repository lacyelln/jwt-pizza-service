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

async function createFakeFranchise() {
    const res = await request(app).post('/api/franchise').set('Authorization',`Bearer ${adminAuthToken}`)
            .send({ name: randomName(), admins: [{email: adminUser.email}] });
    return res;
}

test('create franchise', async() => {
    const res = await request(app).get('/api/franchise').set('Authorization',`Bearer ${adminAuthToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.franchises)).toBe(true);
});

test('delete franchise', async() => {
    const res = await request(app).delete('/api/franchise/:franchiseId').set('Authorization', `Bearer ${adminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('franchise deleted');
});

test('get franchise', async() => {
    const res = await request(app).get('/api/franchise/:userId').set('Authorization', `Bearer ${adminAuthToken}`);
    expect(res.status).toBe(200);
});

test('create store', async () => {
  const franchiseRes = await createFakeFranchise();
  const franchiseId = franchiseRes.body.id;
  const storeData = { name: 'Test Store' };
  const res = await request(app)
    .post(`/api/franchise/${franchiseId}/store`) // ✅ proper template string
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(storeData);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('id');
  expect(res.body).toMatchObject({
    name: 'Test Store'
  });
});

test('delete store', async() => {
    const res = await request(app).delete('/api/franchise/:franchiseId/store/:storeId').set('Authorization', `Bearer ${adminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('store deleted');
    
    
})