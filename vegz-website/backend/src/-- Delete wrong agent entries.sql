-- Delete wrong agent entries
DELETE FROM agents WHERE mobile IN ('+919876000001','+919876000002','+919876000003');

-- Insert with your actual mobile and correct hash
-- Replace 9999999999 with YOUR mobile number
-- Replace PASTE_HASH_HERE with output from Step 1
INSERT INTO agents (name, mobile, email, password_hash, vehicle_type, zone, is_active)
VALUES ('Raju Agent', '+919999999999', 'agent@vegz.online', '$2a$12$nHIbzoxf/0aztJI3k77qxORsshTsMifxtUeqx0UrFfzER8YCFeTE.', 'bike', 'Mundargi', 1);

-- Verify it's there
SELECT id, name, mobile, zone FROM agents;
EXIT;