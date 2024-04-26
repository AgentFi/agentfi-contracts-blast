// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControlLibrary } from "./../../libraries/AccessControlLibrary.sol";


contract MockAccessControl {

    /// @notice Emitted when a role is granted or revoked.
    event RoleAccessChanged(bytes32 indexed role, address indexed account, bool accessGranted);

    struct SetRolesParam {
        bytes32 role;
        address account;
        bool grantAccess;
    }

    /**
     * @notice Grants or revokes a set of roles.
     * Can only be called by a valid executor for this TBA.
     * @param params The list of roles to set.
     */
    function setRoles(SetRolesParam[] calldata params) external payable {
        AccessControlLibrary.AccessControlLibraryStorage storage acls = AccessControlLibrary.accessControlLibraryStorage();
        for(uint256 i = 0; i < params.length; ++i) {
            bytes32 role = params[i].role;
            address account = params[i].account;
            bool grantAccess = params[i].grantAccess;
            acls.assignedRoles[role][account] = grantAccess;
            emit RoleAccessChanged(role, account, grantAccess);
        }
    }

    /**
     * @notice Returns true if `account` has `role`.
     * @param role The role hash.
     * @param account The account to query.
     * @return hasRole_ True if account has the role, false otherwise.
     */
    function hasRole(bytes32 role, address account) external view returns (bool hasRole_) {
        hasRole_ = AccessControlLibrary.hasRole(role, account);
    }

    /**
     * @notice Reverts if `account` does not have `role`.
     * @param role The role hash.
     * @param account The account to query.
     */
    function validateHasRole(bytes32 role, address account) external view {
        AccessControlLibrary.validateHasRole(role, account);
    }
}
