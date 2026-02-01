/**
 * PostgreSQL Database Seeder
 *
 * Creates a sample database with realistic dummy data for manual testing.
 * Uses the Docker PostgreSQL instance from docker-compose.yaml
 *
 * Usage:
 *   pnpm seed
 *   pnpm seed --drop  # Drop and recreate all tables first
 */

import { Client } from "pg";

const config = {
  host: process.env.SEED_DB_HOST ?? "localhost",
  port: parseInt(process.env.SEED_DB_PORT ?? "5432", 10),
  database: process.env.SEED_DB_NAME ?? "maetrik_dev",
  user: process.env.SEED_DB_USER ?? "maetrik",
  password: process.env.SEED_DB_PASSWORD ?? "maetrik",
};

// Sample data generators
const firstNames = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Edward",
  "Fiona",
  "George",
  "Hannah",
  "Ivan",
  "Julia",
  "Kevin",
  "Laura",
  "Michael",
  "Nina",
  "Oscar",
  "Paula",
  "Quinn",
  "Rachel",
  "Steve",
  "Tina",
];

const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
];

const cities = [
  "New York",
  "Los Angeles",
  "Chicago",
  "Houston",
  "Phoenix",
  "Philadelphia",
  "San Antonio",
  "San Diego",
  "Dallas",
  "San Jose",
  "Austin",
  "Jacksonville",
  "Fort Worth",
  "Columbus",
  "Charlotte",
  "Seattle",
  "Denver",
  "Boston",
  "Portland",
  "Miami",
];

const states = [
  "NY",
  "CA",
  "IL",
  "TX",
  "AZ",
  "PA",
  "TX",
  "CA",
  "TX",
  "CA",
  "TX",
  "FL",
  "TX",
  "OH",
  "NC",
  "WA",
  "CO",
  "MA",
  "OR",
  "FL",
];

const productCategories = [
  "Electronics",
  "Clothing",
  "Home & Garden",
  "Sports",
  "Books",
  "Toys",
  "Food & Beverages",
  "Health & Beauty",
];

const products = [
  { name: "Wireless Headphones", category: "Electronics", price: 79.99 },
  { name: "USB-C Cable", category: "Electronics", price: 12.99 },
  { name: "Mechanical Keyboard", category: "Electronics", price: 149.99 },
  { name: "27-inch Monitor", category: "Electronics", price: 299.99 },
  { name: "Webcam HD", category: "Electronics", price: 59.99 },
  { name: "Cotton T-Shirt", category: "Clothing", price: 24.99 },
  { name: "Denim Jeans", category: "Clothing", price: 49.99 },
  { name: "Running Shoes", category: "Clothing", price: 89.99 },
  { name: "Winter Jacket", category: "Clothing", price: 129.99 },
  { name: "Baseball Cap", category: "Clothing", price: 19.99 },
  { name: "Garden Hose", category: "Home & Garden", price: 34.99 },
  { name: "Plant Pot Set", category: "Home & Garden", price: 29.99 },
  { name: "LED Desk Lamp", category: "Home & Garden", price: 44.99 },
  { name: "Throw Pillow", category: "Home & Garden", price: 22.99 },
  { name: "Yoga Mat", category: "Sports", price: 29.99 },
  { name: "Dumbbells 10lb", category: "Sports", price: 39.99 },
  { name: "Tennis Racket", category: "Sports", price: 79.99 },
  { name: "Basketball", category: "Sports", price: 24.99 },
  { name: "JavaScript Guide", category: "Books", price: 39.99 },
  { name: "Cooking Basics", category: "Books", price: 24.99 },
  { name: "Sci-Fi Novel", category: "Books", price: 14.99 },
  { name: "Building Blocks", category: "Toys", price: 34.99 },
  { name: "Board Game", category: "Toys", price: 29.99 },
  { name: "Organic Coffee", category: "Food & Beverages", price: 15.99 },
  { name: "Protein Bars", category: "Food & Beverages", price: 24.99 },
  { name: "Shampoo", category: "Health & Beauty", price: 8.99 },
  { name: "Vitamin C Tablets", category: "Health & Beauty", price: 12.99 },
];

const orderStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];

function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(startYear: number, endYear: number): Date {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start));
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function createTables(client: Client): Promise<void> {
  console.log("Creating tables...");

  await client.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      phone VARCHAR(20),
      address VARCHAR(200),
      city VARCHAR(100),
      state VARCHAR(2),
      zip_code VARCHAR(10),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      category_id INTEGER REFERENCES categories(id),
      price DECIMAL(10, 2) NOT NULL,
      stock_quantity INTEGER DEFAULT 0,
      sku VARCHAR(50) UNIQUE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      order_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      total_amount DECIMAL(10, 2) DEFAULT 0,
      shipping_address VARCHAR(200),
      shipping_city VARCHAR(100),
      shipping_state VARCHAR(2),
      shipping_zip VARCHAR(10),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      subtotal DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id),
      customer_id INTEGER REFERENCES customers(id),
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      title VARCHAR(200),
      content TEXT,
      is_verified_purchase BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Tables created successfully.");
}

async function dropTables(client: Client): Promise<void> {
  console.log("Dropping existing tables...");
  await client.query(`
    DROP TABLE IF EXISTS reviews CASCADE;
    DROP TABLE IF EXISTS order_items CASCADE;
    DROP TABLE IF EXISTS orders CASCADE;
    DROP TABLE IF EXISTS products CASCADE;
    DROP TABLE IF EXISTS customers CASCADE;
    DROP TABLE IF EXISTS categories CASCADE;
  `);
  console.log("Tables dropped.");
}

async function seedCategories(client: Client): Promise<Map<string, number>> {
  console.log("Seeding categories...");
  const categoryMap = new Map<string, number>();

  for (const category of productCategories) {
    const result = await client.query(
      `INSERT INTO categories (name, description) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [category, `All ${category.toLowerCase()} products`]
    );
    categoryMap.set(category, result.rows[0].id);
  }

  console.log(`  Seeded ${productCategories.length} categories.`);
  return categoryMap;
}

async function seedCustomers(client: Client, count: number): Promise<number[]> {
  console.log(`Seeding ${count} customers...`);
  const customerIds: number[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = random(firstNames);
    const lastName = random(lastNames);
    const cityIndex = randomInt(0, cities.length - 1);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;

    const result = await client.query(
      `INSERT INTO customers (first_name, last_name, email, phone, address, city, state, zip_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
       RETURNING id`,
      [
        firstName,
        lastName,
        email,
        `555-${String(randomInt(100, 999))}-${String(randomInt(1000, 9999))}`,
        `${randomInt(100, 9999)} ${random(["Main", "Oak", "Maple", "Cedar", "Pine"])} ${random(["St", "Ave", "Blvd", "Dr", "Ln"])}`,
        cities[cityIndex],
        states[cityIndex],
        String(randomInt(10000, 99999)),
      ]
    );
    customerIds.push(result.rows[0].id);
  }

  console.log(`  Seeded ${count} customers.`);
  return customerIds;
}

async function seedProducts(
  client: Client,
  categoryMap: Map<string, number>
): Promise<number[]> {
  console.log(`Seeding ${products.length} products...`);
  const productIds: number[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const categoryId = categoryMap.get(product.category);
    const sku = `SKU-${String(i + 1).padStart(5, "0")}`;

    const result = await client.query(
      `INSERT INTO products (name, description, category_id, price, stock_quantity, sku)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [
        product.name,
        `High quality ${product.name.toLowerCase()} for everyday use.`,
        categoryId,
        product.price,
        randomInt(0, 500),
        sku,
      ]
    );
    productIds.push(result.rows[0].id);
  }

  console.log(`  Seeded ${products.length} products.`);
  return productIds;
}

async function seedOrders(
  client: Client,
  customerIds: number[],
  productIds: number[],
  orderCount: number
): Promise<void> {
  console.log(`Seeding ${orderCount} orders with items...`);

  for (let i = 0; i < orderCount; i++) {
    const customerId = random(customerIds);
    const orderDate = randomDate(2023, 2025);
    const status = random(orderStatuses);
    const cityIndex = randomInt(0, cities.length - 1);

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, order_date, status, shipping_address, shipping_city, shipping_state, shipping_zip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        customerId,
        formatDate(orderDate),
        status,
        `${randomInt(100, 9999)} Shipping ${random(["St", "Ave", "Blvd"])}`,
        cities[cityIndex],
        states[cityIndex],
        String(randomInt(10000, 99999)),
      ]
    );
    const orderId = orderResult.rows[0].id;

    // Add 1-5 items to order
    const itemCount = randomInt(1, 5);
    let totalAmount = 0;
    const usedProducts = new Set<number>();

    for (let j = 0; j < itemCount; j++) {
      let productId: number;
      do {
        productId = random(productIds);
      } while (usedProducts.has(productId));
      usedProducts.add(productId);

      const quantity = randomInt(1, 3);
      const product = products[productIds.indexOf(productId)];
      const unitPrice = product?.price ?? randomInt(10, 100);
      const subtotal = quantity * unitPrice;
      totalAmount += subtotal;

      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, productId, quantity, unitPrice, subtotal]
      );
    }

    // Update order total
    await client.query(`UPDATE orders SET total_amount = $1 WHERE id = $2`, [
      totalAmount,
      orderId,
    ]);
  }

  console.log(`  Seeded ${orderCount} orders with items.`);
}

async function seedReviews(
  client: Client,
  customerIds: number[],
  productIds: number[],
  reviewCount: number
): Promise<void> {
  console.log(`Seeding ${reviewCount} reviews...`);

  const reviewTitles = [
    "Great product!",
    "Exactly what I needed",
    "Good value for money",
    "Disappointed",
    "Exceeded expectations",
    "Average quality",
    "Would buy again",
    "Not as described",
    "Perfect!",
    "Decent purchase",
  ];

  for (let i = 0; i < reviewCount; i++) {
    const rating = randomInt(1, 5);
    await client.query(
      `INSERT INTO reviews (product_id, customer_id, rating, title, content, is_verified_purchase)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        random(productIds),
        random(customerIds),
        rating,
        random(reviewTitles),
        rating >= 4
          ? "I really enjoyed this product. Would recommend to others."
          : rating >= 3
            ? "It's okay, does what it's supposed to do."
            : "Not what I expected. Could be better.",
        Math.random() > 0.3,
      ]
    );
  }

  console.log(`  Seeded ${reviewCount} reviews.`);
}

async function main(): Promise<void> {
  const shouldDrop = process.argv.includes("--drop");

  console.log("\n=== PostgreSQL Database Seeder ===\n");
  console.log(`Connecting to ${config.host}:${config.port}/${config.database}...`);

  const client = new Client(config);

  try {
    await client.connect();
    console.log("Connected successfully.\n");

    if (shouldDrop) {
      await dropTables(client);
    }

    await createTables(client);
    console.log("");

    const categoryMap = await seedCategories(client);
    const customerIds = await seedCustomers(client, 50);
    const productIds = await seedProducts(client, categoryMap);
    await seedOrders(client, customerIds, productIds, 200);
    await seedReviews(client, customerIds, productIds, 150);

    console.log("\n=== Seeding Complete ===\n");
    console.log("Summary:");
    console.log("  - 8 categories");
    console.log("  - 50 customers");
    console.log("  - 27 products");
    console.log("  - 200 orders (with items)");
    console.log("  - 150 reviews");
    console.log("\nYou can now add this database as a connection in Maetrik.");
    console.log("Example config:\n");
    console.log(`  dataSources:
    - id: "test-db"
      type: postgres
      credentials:
        host: localhost
        port: 5432
        database: maetrik_dev
        user: maetrik
        password: maetrik
`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
