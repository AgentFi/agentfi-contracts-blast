// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./AccountV3.sol"; // tokenbound base account contract

/**
 * @title AccountV3WithAccessControl
 * @author LMAO Labs
 * @notice A TBA that enables role based access control.
 *
 * Different functions within and across TBAs require different different access control lists. Many of these functions are limited to just the TBA owner or its root owner. Some implementations allow a permissioned user to assume owner permissions.
 *
 * Role based access control allows the owner to grant and revoke access to a subset of protected functions as they set fit.
 */
contract AccountV3WithAccessControl is AccountV3 {

    // role hash => role owner => is role assigned
    mapping(bytes32 => mapping(address => bool)) internal assignedRoles;
    /// @notice Emitted when a role is granted or revoked.
    event RoleAccessChanged(bytes32 indexed role, address indexed account, bool accessGranted);

    constructor(
        address entryPoint_,
        address multicallForwarder,
        address erc6551Registry,
        address _guardian
    ) AccountV3(entryPoint_, multicallForwarder, erc6551Registry, _guardian) {}

    /***************************************
    VIEW FUNCTIONS
    ***************************************/

    function getGuardian() external view returns (address) {
        return address(guardian);
    }

    function getImplementation() external view returns (address) {
        return __self;
    }

    /***************************************
    ACCESS CONTROL FUNCTIONS
    ***************************************/

    /**
     * @notice Returns true if `account` has `role`.
     * @param role The role hash.
     * @param account The account to query.
     * @return hasRole_ True if account has the role, false otherwise.
     */
    function hasRole(bytes32 role, address account) external view returns (bool hasRole_) {
        hasRole_ = assignedRoles[role][account];
    }

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
    function setRoles(SetRolesParam[] calldata params) external {
        _verifySenderIsValidExecutor();
        _verifyIsUnlocked();
        _updateState();
        for(uint256 i; i < params.length; ++i) {
            bytes32 role = params[i].role;
            address account = params[i].account;
            bool grantAccess = params[i].grantAccess;
            assignedRoles[role][account] = grantAccess;
            emit RoleAccessChanged(role, account, grantAccess);
        }
    }

    /**
     * @notice Reverts if `_msgSender()` is not a valid executor and does not have have `role`.
     * @param role The role that the sender should have.
     */
    function _verifySenderIsValidExecutorOrHasRole(bytes32 role) internal view {
        address sender = _msgSender();
        if(assignedRoles[role][sender]) return;
        if(_isValidExecutor(sender)) return;
        revert NotAuthorized();
    }
}
