import type { EntityManager } from "typeorm";
import { UserRoleAssignment } from "./entities/user-role.entity";
import { User, UserRole, UserStatus } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";

describe("UsersRepository", () => {
	it("locks the User row and reloads current role assignments", async () => {
		const repository = new UsersRepository(User, {} as EntityManager);
		const user = {
			id: "user-1",
			role: UserRole.PORTER,
			status: UserStatus.ACTIVE,
		} as User;
		const roleAssignments = [{ userId: user.id, role: UserRole.PORTER }] as UserRoleAssignment[];
		jest.spyOn(repository, "findOne").mockResolvedValue(user);
		const findBy = jest.fn().mockResolvedValue(roleAssignments);
		Object.defineProperty(repository, "manager", {
			value: { getRepository: jest.fn().mockReturnValue({ findBy }) },
		});

		await expect(repository.findOneWithRolesByIdForUpdate(user.id)).resolves.toMatchObject({
			roleAssignments,
		});
		expect(repository.findOne).toHaveBeenCalledWith({
			where: { id: user.id },
			lock: { mode: "pessimistic_write" },
		});
		expect(repository.manager.getRepository).toHaveBeenCalledWith(UserRoleAssignment);
		expect(findBy).toHaveBeenCalledWith({ userId: user.id });
	});
});
