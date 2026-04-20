import { buildCustomer, buildAddress } from "../../shared/src/fixtures/customer.factory";

describe("Customer Factory", () => {
  describe("buildCustomer()", () => {
    it("produces a customer with all required fields populated", () => {
      const customer = buildCustomer();
      expect(customer.firstName).toBeTruthy();
      expect(customer.lastName).toBeTruthy();
      expect(customer.username).toBeTruthy();
      expect(customer.password).toBeTruthy();
      expect(customer.ssn).toBeTruthy();
      expect(customer.phoneNumber).toBeTruthy();
      expect(customer.address).toBeDefined();
    });

    it("produces unique usernames across multiple calls", () => {
      const usernames = Array.from({ length: 20 }, () => buildCustomer().username);
      const unique = new Set(usernames);
      expect(unique.size).toBe(20);
    });

    it("produces unique SSNs across multiple calls", () => {
      const ssns = Array.from({ length: 20 }, () => buildCustomer().ssn);
      const unique = new Set(ssns);
      expect(unique.size).toBeGreaterThan(15); // allow tiny collision chance
    });

    it("allows field overrides", () => {
      const customer = buildCustomer({ firstName: "Alice", lastName: "Smith" });
      expect(customer.firstName).toBe("Alice");
      expect(customer.lastName).toBe("Smith");
    });

    it("SSN is numeric digits only", () => {
      const { ssn } = buildCustomer();
      expect(ssn).toMatch(/^\d+$/);
    });

    it("password meets minimum complexity (has digit and uppercase)", () => {
      const { password } = buildCustomer();
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
    });
  });

  describe("buildAddress()", () => {
    it("produces an address with all required fields", () => {
      const address = buildAddress();
      expect(address.street).toBeTruthy();
      expect(address.city).toBeTruthy();
      expect(address.state).toMatch(/^[A-Z]{2}$/);
      expect(address.zipCode).toMatch(/^\d{5}$/);
    });

    it("allows field overrides", () => {
      const address = buildAddress({ city: "TestCity", state: "NY" });
      expect(address.city).toBe("TestCity");
      expect(address.state).toBe("NY");
    });
  });
});
