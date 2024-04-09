// SPDX-License-Identifier: none
pragma solidity 0.8.24;

import { Errors } from "./Errors.sol";


/**
 * @title AccessControlLibrary
 * @author AgentFi
 * @notice A library that helps enforce access control.
 */
library AccessControlLibrary {

    /***************************************
    STORAGE
    ***************************************/

    /// @notice The role for strategy managers.
    bytes32 public constant STRATEGY_MANAGER_ROLE = keccak256("STRATEGY_MANAGER_ROLE");
    /// @notice The role for gas collectors.
    bytes32 public constant GAS_COLLECTOR_ROLE = keccak256("GAS_COLLECTOR_ROLE");

    bytes32 constant private ACCESS_CONTROL_LIBRARY_STORAGE_POSITION = keccak256("agentfi.storage.accesscontrol");

    struct AccessControlLibraryStorage {
        // role hash => role owner => is role assigned
        mapping(bytes32 => mapping(address => bool)) assignedRoles;
    }

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    /**
     * @notice Returns the `AccessControlLibraryStorage` struct.
     * @return acls The `AccessControlLibraryStorage` struct.
     */
    function accessControlLibraryStorage() internal pure returns (AccessControlLibraryStorage storage acls) {
        bytes32 position = ACCESS_CONTROL_LIBRARY_STORAGE_POSITION;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            acls.slot := position
        }
    }

    /**
     * @notice Returns true if `account` has `role`.
     * @param role The role hash.
     * @param account The account to query.
     * @return hasRole_ True if account has the role, false otherwise.
     */
    function hasRole(bytes32 role, address account) internal view returns (bool hasRole_) {
        AccessControlLibraryStorage storage acls = accessControlLibraryStorage();
        hasRole_ = acls.assignedRoles[role][account];
    }

    /**
     * @notice Reverts if `account` does not have `role`.
     * @param role The role hash.
     * @param account The account to query.
     */
    function validateHasRole(bytes32 role, address account) internal view {
        if(!hasRole(role, account)) revert Errors.NotAuthorized();
    }
}
